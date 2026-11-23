// Runs a spec's task graph from start (or resume) to finish. Every side effect goes through the
// injected ports, so tests drive whole runs against fakes and a temp repository root.
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  continuePrompt,
  explorerPrompt,
  fixerPrompt,
  implementerPrompt,
  mergerPrompt,
  prWriterPrompt,
  reviewerPrompt,
  type Pointers
} from './prompts.ts'

/** An issue that blocks a ticket, with its state on GitHub. */
export type Blocker = { number: number; open: boolean }

/** One of the spec's open sub-issues, with its native `blocked_by` edges. */
export type Ticket = { number: number; title: string; open: boolean; blockedBy: Blocker[] }

export type TrackerPort = {
  /** The spec's open sub-issues and their blockers, read once per run. */
  readSpec: (spec: number) => Promise<Ticket[]>
  /** Opens a draft PR from `head` into `base` and resolves to its number. */
  openDraftPr: (pr: { head: string; base: string; title: string; body: string }) => Promise<number>
  /** Replaces a PR's body with the contents of `bodyFile`. */
  setPrBody: (pr: number, bodyFile: string) => Promise<void>
  /** Marks a draft PR ready for review. */
  markPrReady: (pr: number) => Promise<void>
}

export type GitPort = {
  /** The main repository's root, the same from any checkout or worktree. */
  repoRoot: () => Promise<string>
  branchExists: (branch: string) => Promise<boolean>
  /** The path of the worktree that has the branch checked out, or null when none does. */
  worktreeFor: (branch: string) => Promise<string | null>
  /** Adds a worktree at `path` for `branch`; with `base`, creates the branch from `base` first. */
  addWorktree: (path: string, branch: string, base?: string) => Promise<void>
  /** The commit a branch points at. */
  head: (branch: string) => Promise<string>
  /** Whether `branch` has any commit that `base` does not. */
  hasCommitsBeyond: (branch: string, base: string) => Promise<boolean>
  /** Whether `commit` is reachable from `branch`. */
  contains: (branch: string, commit: string) => Promise<boolean>
  /** Removes the worktree at `path`, keeping its branch. */
  removeWorktree: (path: string) => Promise<void>
}

/** The roles a `claude` session can play in a run. */
export type Role = 'explorer' | 'implementer' | 'merger' | 'reviewer' | 'fixer' | 'pr-writer'

/** One role session: started with `sessionId`, or resumed by it, in `cwd`, all output to `logFile`. */
export type ClaudeSession = {
  role: Role
  cwd: string
  prompt: string
  sessionId: string
  resume: boolean
  logFile: string
}

export type ClaudePort = {
  /** Runs one session to its end and resolves to its exit code. */
  run: (session: ClaudeSession) => Promise<number>
}

export type Ports = {
  tracker: TrackerPort
  git: GitPort
  claude: ClaudePort
  log: (line: string) => void
}

export type RunOptions = { explore?: boolean }

export type RunResult = { ok: boolean; frontier: number[] }

/**
 * `implemented`: the implementer passed its done check and the ticket waits to be merged.
 * `done`: merged into the integration branch.
 */
export type TicketStatus = 'pending' | 'running' | 'implemented' | 'done' | 'failed'

/**
 * A session's done check: `passed`, or the first check that failed. Implementers can fail
 * `nonzero-exit`, `no-commits` or `missing-launch-commit`; mergers `nonzero-exit` or `not-merged`
 * (the integration branch doesn't contain the ticket branch's head); the PR writer `nonzero-exit`
 * or `no-pr-body` (it wrote no PR body file).
 */
export type DoneCheck =
  'passed' | 'nonzero-exit' | 'no-commits' | 'missing-launch-commit' | 'not-merged' | 'no-pr-body'

/** How a session ended: its exit code and the done check the script ran on it. */
export type SessionOutcome = { exitCode: number; check: DoneCheck }

/** A role session's ID, saved before it launches, and its outcome once it has ended. */
export type SessionState = { id: string; outcome?: SessionOutcome }

export type TicketState = {
  status: TicketStatus
  /** The integration tip the ticket's branch was cut from. */
  launchCommit?: string
  /** The implementer session. */
  session?: SessionState
  /** The merger session that merges the ticket branch into the integration branch. */
  merger?: SessionState
}

/**
 * A step of the run not tied to a ticket. `explore` runs before any implementer, when asked for.
 * The end of the run, once every ticket is `done`: `review`, `fix` and `pr-description` are role
 * sessions; `ready` replaces the PR body, marks the PR ready and removes the integration worktree.
 */
export type StepName = 'explore' | 'review' | 'fix' | 'pr-description' | 'ready'

/** A step's status and its session (every step but `ready` has one). A `done` step is never run again. */
export type StepState = { status: 'running' | 'done' | 'failed'; session?: SessionState }

/** The run's persisted state, rewritten after every transition. */
export type RunState = {
  spec: number
  integrationBranch: string
  integrationWorktree: string
  tickets: Record<number, TicketState>
  /** Steps not tied to a ticket that have started, by name. */
  steps?: Partial<Record<StepName, StepState>>
  /** The draft PR from the integration branch, opened after the first merge. */
  pr?: number
}

/** Where a spec's run lives: state, notes, logs and the PR body, under the main repository root. */
export const runPaths = (root: string, spec: number) => {
  const dir = join(root, '.implement-spec', String(spec))
  return {
    dir,
    state: join(dir, 'state.json'),
    notes: join(dir, 'notes'),
    logs: join(dir, 'logs'),
    prBody: join(dir, 'pr-body.md')
  }
}

export const integrationBranch = (spec: number) => `implement-spec/${spec}`

export const ticketBranch = (spec: number, ticket: number) => `implement-spec/${spec}-${ticket}`

/** A session's log: `logs/<role>-<ticket#>.log`, or `logs/<role>.log` for a role not tied to a ticket. */
export const logPath = (logs: string, role: Role, ticket?: number) =>
  join(logs, ticket === undefined ? `${role}.log` : `${role}-${ticket}.log`)

const worktreePath = (root: string, branch: string) =>
  join(root, '.claude', 'worktrees', branch.replaceAll('/', '-'))

const loadState = (path: string): RunState | null =>
  existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as RunState) : null

const saveState = (path: string, state: RunState) => {
  writeFileSync(`${path}.tmp`, JSON.stringify(state, null, 2) + '\n')
  renameSync(`${path}.tmp`, path)
}

/** The integration branch's worktree: reused when it exists, otherwise created (and the branch cut from `main`). */
const prepareIntegration = async (git: GitPort, root: string, branch: string) => {
  const existing = await git.worktreeFor(branch)
  if (existing) return existing
  const path = worktreePath(root, branch)
  if (await git.branchExists(branch)) await git.addWorktree(path, branch)
  else await git.addWorktree(path, branch, 'main')
  return path
}

/** A ticket is ready when it is pending and open, and every blocker is closed on GitHub or done in this run. */
const readyTickets = (tickets: Ticket[], state: RunState) =>
  tickets
    .filter(
      (ticket) =>
        ticket.open &&
        state.tickets[ticket.number]?.status === 'pending' &&
        ticket.blockedBy.every(
          (blocker) => !blocker.open || state.tickets[blocker.number]?.status === 'done'
        )
    )
    .map((ticket) => ticket.number)

/** Everything a run's steps share. `save` persists `state`, and is called after every transition. */
type Run = {
  spec: number
  root: string
  paths: ReturnType<typeof runPaths>
  branch: string
  state: RunState
  save: () => void
  ports: Ports
}

const pointers = (run: Run): Pointers => ({
  spec: run.spec,
  integrationBranch: run.branch,
  notes: run.paths.notes
})

/** Why a session didn't complete, as its continue prompt states it. */
const unfinishedReason = ({ outcome }: SessionState) => {
  if (outcome === undefined) return 'it was interrupted, as the run stopped while it was running'
  if (outcome.check === 'nonzero-exit') return `it exited with code ${outcome.exitCode}`
  return `it exited ${outcome.exitCode} but failed the done check: ${outcome.check}`
}

/**
 * The session to run in place of `previous`: `previous` itself, resumed with a continue prompt
 * naming why it didn't complete, or a fresh session with a new ID when there is none to resume.
 * A resumed session's old outcome is cleared, so an interruption now reads as one.
 */
const nextSession = (previous: SessionState | undefined, prompt: string) => {
  if (previous === undefined || previous.outcome?.check === 'passed') {
    return { session: { id: randomUUID() } as SessionState, resume: false, prompt }
  }
  const resumedPrompt = continuePrompt(unfinishedReason(previous), prompt)
  delete previous.outcome
  return { session: previous, resume: true, prompt: resumedPrompt }
}

/** A ticket whose implementer didn't complete: left `running` by a stopped run, or `failed`. */
const unfinishedImplementer = (entry: TicketState) =>
  (entry.status === 'running' || entry.status === 'failed') &&
  entry.session !== undefined &&
  entry.launchCommit !== undefined

/**
 * Runs one role session for a step in the integration worktree, unless an earlier run finished
 * the step: the step's earlier session resumed when it didn't complete, otherwise a fresh one. It
 * passes on exit 0, or with `check` deciding beyond that. Resolves to whether the step is done.
 */
const sessionStep = async (
  run: Run,
  name: StepName,
  role: Role,
  prompt: string,
  check: (exitCode: number) => DoneCheck = (exitCode) =>
    exitCode === 0 ? 'passed' : 'nonzero-exit'
): Promise<boolean> => {
  const { claude, log } = run.ports
  if (run.state.steps?.[name]?.status === 'done') return true
  const logFile = logPath(run.paths.logs, role)
  const next = nextSession(run.state.steps?.[name]?.session, prompt)
  const { session } = next
  const step: StepState = { status: 'running', session }
  run.state.steps = { ...run.state.steps, [name]: step }
  run.save()

  log(`${next.resume ? 'resumed' : 'launched'} ${role} (log ${logFile})`)
  const exitCode = await claude.run({
    role,
    cwd: run.state.integrationWorktree,
    prompt: next.prompt,
    sessionId: session.id,
    resume: next.resume,
    logFile
  })

  const result = check(exitCode)
  session.outcome = { exitCode, check: result }
  step.status = result === 'passed' ? 'done' : 'failed'
  run.save()
  if (result !== 'passed') log(`failed ${role}: ${result} (log ${logFile})`)
  return result === 'passed'
}

/** Runs the explorer, unless an earlier run finished exploring. Resolves to whether exploration is done. */
const explore = async (run: Run): Promise<boolean> => {
  if (run.state.steps?.explore?.status === 'done') return true
  const done = await sessionStep(run, 'explore', 'explorer', explorerPrompt(pointers(run)))
  if (done) run.ports.log(`explored (notes ${run.paths.notes})`)
  return done
}

/** The first done check an implementer fails, or `passed`. */
const doneCheck = async (
  git: GitPort,
  branch: string,
  launchCommit: string,
  exitCode: number
): Promise<DoneCheck> => {
  if (exitCode !== 0) return 'nonzero-exit'
  if (!(await git.hasCommitsBeyond(branch, launchCommit))) return 'no-commits'
  if (!(await git.contains(branch, launchCommit))) return 'missing-launch-commit'
  return 'passed'
}

/**
 * Runs the ticket's implementer and applies the done check. A ticket whose implementer didn't
 * complete in an earlier run goes back to `running` and has that session resumed in its worktree,
 * against its original launch commit. Otherwise the ticket's branch and worktree are cut from the
 * integration tip and a fresh implementer runs there. Resolves to whether the ticket passed.
 */
const implement = async (run: Run, ticket: number): Promise<boolean> => {
  const { git, claude, log } = run.ports
  const branch = ticketBranch(run.spec, ticket)
  const cwd = worktreePath(run.root, branch)
  const logFile = logPath(run.paths.logs, 'implementer', ticket)
  const previous = run.state.tickets[ticket]
  const resumable = unfinishedImplementer(previous) && (await git.branchExists(branch))
  const launchCommit = resumable ? (previous.launchCommit as string) : await git.head(run.branch)
  const next = nextSession(
    resumable ? previous.session : undefined,
    implementerPrompt(pointers(run), { ticket, branch })
  )
  const { session } = next
  const entry: TicketState = { ...previous, status: 'running', launchCommit, session }
  run.state.tickets[ticket] = entry
  run.save()
  if (!resumable) await git.addWorktree(cwd, branch, launchCommit)
  else if ((await git.worktreeFor(branch)) === null) await git.addWorktree(cwd, branch)

  log(`${next.resume ? 'resumed' : 'launched'} #${ticket} implementer (log ${logFile})`)
  const exitCode = await claude.run({
    role: 'implementer',
    cwd,
    prompt: next.prompt,
    sessionId: session.id,
    resume: next.resume,
    logFile
  })

  const check = await doneCheck(git, branch, launchCommit, exitCode)
  session.outcome = { exitCode, check }
  entry.status = check === 'passed' ? 'implemented' : 'failed'
  run.save()
  if (check === 'passed') log(`implemented #${ticket}`)
  else log(`failed #${ticket} implementer: ${check} (log ${logFile})`)
  return check === 'passed'
}

/** The merger's done check: it exited 0 and the integration branch contains the ticket branch's head. */
const mergeCheck = async (
  git: GitPort,
  integration: string,
  ticketHead: string,
  exitCode: number
): Promise<DoneCheck> => {
  if (exitCode !== 0) return 'nonzero-exit'
  if (!(await git.contains(integration, ticketHead))) return 'not-merged'
  return 'passed'
}

/** The minimal PR body: `Closes #<spec>`, then one `Closes #<ticket>` line per ticket in the run. */
const closesBody = (run: Run) =>
  [run.spec, ...Object.keys(run.state.tickets).map(Number)]
    .map((number) => `Closes #${number}`)
    .join('\n')

/** Opens the draft PR from the integration branch, unless this or an earlier run already did. */
const openPr = async (run: Run) => {
  if (run.state.pr !== undefined) return
  run.state.pr = await run.ports.tracker.openDraftPr({
    head: run.branch,
    base: 'main',
    title: `feat: implement spec #${run.spec}`,
    body: closesBody(run)
  })
  run.save()
  run.ports.log(`opened draft PR #${run.state.pr}`)
}

/**
 * Runs a merger in the integration worktree to merge an implemented ticket's branch: the ticket's
 * earlier merger resumed when it didn't complete, otherwise a fresh one. On a pass the ticket is
 * `done` and its worktree removed; on a failure it stays `implemented`, with the merger's outcome
 * recorded. The first pass opens the draft PR. Resolves to whether the merge passed.
 */
const merge = async (run: Run, ticket: number): Promise<boolean> => {
  const { git, claude, log } = run.ports
  const branch = ticketBranch(run.spec, ticket)
  const logFile = logPath(run.paths.logs, 'merger', ticket)
  const ticketHead = await git.head(branch)
  const entry = run.state.tickets[ticket]
  const next = nextSession(entry.merger, mergerPrompt(pointers(run), { ticket, branch }))
  const { session } = next
  entry.merger = session
  run.save()

  log(`${next.resume ? 'resumed' : 'launched'} #${ticket} merger (log ${logFile})`)
  const exitCode = await claude.run({
    role: 'merger',
    cwd: run.state.integrationWorktree,
    prompt: next.prompt,
    sessionId: session.id,
    resume: next.resume,
    logFile
  })

  const check = await mergeCheck(git, run.branch, ticketHead, exitCode)
  session.outcome = { exitCode, check }
  if (check !== 'passed') {
    run.save()
    log(`failed #${ticket} merger: ${check} (log ${logFile})`)
    return false
  }
  entry.status = 'done'
  run.save()
  await git.removeWorktree(worktreePath(run.root, branch))
  log(`merged #${ticket}`)
  await openPr(run)
  return true
}

/**
 * Finishes a run whose tickets are all `done`: reviewer, fixer, PR writer, then the PR body is
 * replaced from the PR writer's file and the PR marked ready. Each finished step is recorded, so a
 * re-run picks up at the first unfinished one. Resolves to whether the run finished.
 */
const finish = async (run: Run): Promise<boolean> => {
  const p = pointers(run)
  const bodyFile = run.paths.prBody
  const described = (exitCode: number): DoneCheck =>
    exitCode !== 0 ? 'nonzero-exit' : existsSync(bodyFile) ? 'passed' : 'no-pr-body'
  return (
    (await sessionStep(run, 'review', 'reviewer', reviewerPrompt(p))) &&
    (await sessionStep(run, 'fix', 'fixer', fixerPrompt(p))) &&
    (await sessionStep(
      run,
      'pr-description',
      'pr-writer',
      prWriterPrompt(p, { bodyFile }),
      described
    )) &&
    (await markReady(run))
  )
}

/** `body` with every line of the minimal `Closes` body it lacks appended. */
const withCloses = (run: Run, body: string) => {
  const missing = closesBody(run)
    .split('\n')
    .filter((line) => !new RegExp(`^\\s*${line}\\b`, 'im').test(body))
  return missing.length === 0 ? body : `${body.trimEnd()}\n\n${missing.join('\n')}\n`
}

/**
 * The `ready` step: appends any missing `Closes` lines to the PR body file, replaces the PR body
 * from it, marks the PR ready and removes the integration worktree (the branch is kept).
 */
const markReady = async (run: Run): Promise<boolean> => {
  if (run.state.steps?.ready?.status === 'done') return true
  const { tracker, git, log } = run.ports
  await openPr(run)
  const pr = run.state.pr as number
  const bodyFile = run.paths.prBody
  writeFileSync(bodyFile, withCloses(run, readFileSync(bodyFile, 'utf8')))
  await tracker.setPrBody(pr, bodyFile)
  await tracker.markPrReady(pr)
  await git.removeWorktree(run.state.integrationWorktree)
  run.state.steps = { ...run.state.steps, ready: { status: 'done' } }
  run.save()
  log(`PR #${pr} ready`)
  return true
}

/**
 * Picks up what an earlier run left: first every merger that didn't complete is resumed, one at a
 * time and before anything launches (a failure ends the drive there); then tickets left
 * `implemented` with no merger join the merge queue, and implementers that didn't complete are
 * resumed alongside the first launches.
 *
 * Launches every ready ticket at once, with no cap, and merges implemented tickets one at a time
 * in the order their implementers finished. After each merge the frontier is recomputed and newly
 * ready tickets launch straight away. A failed merger stops new launches and merges; sessions
 * already running finish. Resolves to whether every launched ticket was merged.
 */
const drive = async (run: Run, tickets: Ticket[]): Promise<boolean> => {
  let ok = true
  let halted = false
  let merging = false
  const launched = new Set<number>()
  const queue: number[] = []
  const active = new Set<Promise<void>>()

  const track = (work: Promise<void>) => {
    active.add(work)
    const settle = () => active.delete(work)
    work.then(settle, settle)
  }

  const earlier = (keep: (entry: TicketState) => boolean) =>
    Object.entries(run.state.tickets)
      .filter(([, entry]) => keep(entry))
      .map(([key]) => Number(key))

  for (const ticket of earlier((entry) => entry.status === 'implemented' && !!entry.merger)) {
    if (!(await merge(run, ticket))) return false
  }
  queue.push(...earlier((entry) => entry.status === 'implemented'))
  const resumable = earlier(unfinishedImplementer)

  const step = () => {
    if (halted) return
    for (const ticket of [...resumable.splice(0), ...readyTickets(tickets, run.state)]) {
      if (launched.has(ticket)) continue
      launched.add(ticket)
      track(
        implement(run, ticket).then((passed) => {
          if (passed) queue.push(ticket)
          else ok = false
          step()
        })
      )
    }
    const next = merging ? undefined : queue.shift()
    if (next === undefined) return
    merging = true
    track(
      merge(run, next).then((merged) => {
        merging = false
        if (!merged) {
          ok = false
          halted = true
        }
        step()
      })
    )
  }

  step()
  while (active.size > 0) await Promise.race(active)
  return ok && queue.length === 0
}

/**
 * Prints every failed ticket, ascending, with the session that failed, its check and its log: a
 * `failed` ticket's implementer, or the merger of an `implemented` ticket whose merge failed.
 */
const reportFailures = (run: Run) => {
  const failures = Object.entries(run.state.tickets).flatMap(([key, entry]) => {
    const ticket = Number(key)
    const failed = (role: Role, session?: SessionState) => {
      const check = session?.outcome?.check
      return check === undefined || check === 'passed'
        ? []
        : [`  #${ticket} ${role} ${check} (log ${logPath(run.paths.logs, role, ticket)})`]
    }
    if (entry.status === 'failed') return failed('implementer', entry.session)
    if (entry.status === 'implemented') return failed('merger', entry.merger)
    return []
  })
  if (failures.length === 0) return
  run.ports.log('failed tickets:')
  for (const line of failures) run.ports.log(line)
}

export const runSpec = async (
  spec: number,
  options: RunOptions,
  ports: Ports
): Promise<RunResult> => {
  const { tracker, git, log } = ports
  const root = await git.repoRoot()
  const paths = runPaths(root, spec)
  for (const dir of [paths.dir, paths.notes, paths.logs]) mkdirSync(dir, { recursive: true })

  const saved = loadState(paths.state)
  if (saved?.steps?.ready?.status === 'done') {
    log(`spec #${spec} already finished: PR #${saved.pr} is ready`)
    return { ok: true, frontier: [] }
  }

  const tickets = await tracker.readSpec(spec)
  const branch = integrationBranch(spec)
  const worktree = await prepareIntegration(git, root, branch)

  const state: RunState = saved ?? {
    spec,
    integrationBranch: branch,
    integrationWorktree: worktree,
    tickets: {}
  }
  state.integrationWorktree = worktree
  for (const ticket of tickets) state.tickets[ticket.number] ??= { status: 'pending' }
  const save = () => saveState(paths.state, state)
  const run: Run = { spec, root, paths, branch, state, save, ports }
  save()

  if (options.explore && !(await explore(run))) return { ok: false, frontier: [] }

  const frontier = readyTickets(tickets, state)
  for (const ticket of tickets.filter(({ number }) => frontier.includes(number))) {
    log(`ready #${ticket.number} ${ticket.title}`)
  }
  if (frontier.length === 0) log('nothing is ready')

  const ok = await drive(run, tickets)
  reportFailures(run)
  if (!ok || !Object.values(state.tickets).every(({ status }) => status === 'done')) {
    return { ok, frontier }
  }
  return { ok: await finish(run), frontier }
}
