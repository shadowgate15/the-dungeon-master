// Runs a spec's task graph from start (or resume) to finish. Every side effect goes through the
// injected ports, so tests drive whole runs against fakes and a temp repository root.
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { explorerPrompt, implementerPrompt, mergerPrompt, type Pointers } from './prompts.ts'

/** An issue that blocks a ticket, with its state on GitHub. */
export type Blocker = { number: number; open: boolean }

/** One of the spec's open sub-issues, with its native `blocked_by` edges. */
export type Ticket = { number: number; title: string; open: boolean; blockedBy: Blocker[] }

export type TrackerPort = {
  /** The spec's open sub-issues and their blockers, read once per run. */
  readSpec: (spec: number) => Promise<Ticket[]>
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
 * (the integration branch doesn't contain the ticket branch's head).
 */
export type DoneCheck =
  'passed' | 'nonzero-exit' | 'no-commits' | 'missing-launch-commit' | 'not-merged'

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

/** A step of the run not tied to a ticket. `explore` runs before any implementer, when asked for. */
export type StepName = 'explore'

/** A step's status and its session. A `done` step is never run again. */
export type StepState = { status: 'running' | 'done' | 'failed'; session: SessionState }

/** The run's persisted state, rewritten after every transition. */
export type RunState = {
  spec: number
  integrationBranch: string
  integrationWorktree: string
  tickets: Record<number, TicketState>
  /** Steps not tied to a ticket that have started, by name. */
  steps?: Partial<Record<StepName, StepState>>
}

/** Where a spec's run lives: state, notes, logs and the PR body, under the main repository root. */
export const runPaths = (root: string, spec: number) => {
  const dir = join(root, '.implement-spec', String(spec))
  return {
    dir,
    state: join(dir, 'state.json'),
    notes: join(dir, 'notes'),
    logs: join(dir, 'logs')
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

/**
 * Runs the explorer in the integration worktree, unless an earlier run finished exploring.
 * Resolves to whether exploration is done.
 */
const explore = async (run: Run): Promise<boolean> => {
  const { claude, log } = run.ports
  if (run.state.steps?.explore?.status === 'done') return true
  const logFile = logPath(run.paths.logs, 'explorer')
  const session: SessionState = { id: randomUUID() }
  const step: StepState = { status: 'running', session }
  run.state.steps = { ...run.state.steps, explore: step }
  run.save()

  log(`launched explorer (log ${logFile})`)
  const exitCode = await claude.run({
    role: 'explorer',
    cwd: run.state.integrationWorktree,
    prompt: explorerPrompt(pointers(run)),
    sessionId: session.id,
    resume: false,
    logFile
  })

  const check: DoneCheck = exitCode === 0 ? 'passed' : 'nonzero-exit'
  session.outcome = { exitCode, check }
  step.status = check === 'passed' ? 'done' : 'failed'
  run.save()
  if (check === 'passed') log(`explored (notes ${run.paths.notes})`)
  else log(`failed explorer: ${check} (log ${logFile})`)
  return check === 'passed'
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
 * Cuts the ticket's branch and worktree from the integration tip, runs a fresh implementer there
 * and applies the done check. Resolves to whether the ticket passed.
 */
const implement = async (run: Run, ticket: number): Promise<boolean> => {
  const { git, claude, log } = run.ports
  const branch = ticketBranch(run.spec, ticket)
  const cwd = worktreePath(run.root, branch)
  const logFile = logPath(run.paths.logs, 'implementer', ticket)
  const launchCommit = await git.head(run.branch)
  const session: SessionState = { id: randomUUID() }
  const entry: TicketState = { status: 'running', launchCommit, session }
  run.state.tickets[ticket] = entry
  run.save()
  await git.addWorktree(cwd, branch, launchCommit)

  log(`launched #${ticket} implementer (log ${logFile})`)
  const exitCode = await claude.run({
    role: 'implementer',
    cwd,
    prompt: implementerPrompt(pointers(run), { ticket, branch }),
    sessionId: session.id,
    resume: false,
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

/**
 * Runs a fresh merger in the integration worktree to merge an implemented ticket's branch. On a
 * pass the ticket is `done` and its worktree removed; on a failure it stays `implemented`, with
 * the merger's outcome recorded. Resolves to whether the merge passed.
 */
const merge = async (run: Run, ticket: number): Promise<boolean> => {
  const { git, claude, log } = run.ports
  const branch = ticketBranch(run.spec, ticket)
  const logFile = logPath(run.paths.logs, 'merger', ticket)
  const ticketHead = await git.head(branch)
  const entry = run.state.tickets[ticket]
  const session: SessionState = { id: randomUUID() }
  entry.merger = session
  run.save()

  log(`launched #${ticket} merger (log ${logFile})`)
  const exitCode = await claude.run({
    role: 'merger',
    cwd: run.state.integrationWorktree,
    prompt: mergerPrompt(pointers(run), { ticket, branch }),
    sessionId: session.id,
    resume: false,
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
  return true
}

/**
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

  const step = () => {
    if (halted) return
    for (const ticket of readyTickets(tickets, run.state)) {
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

export const runSpec = async (
  spec: number,
  options: RunOptions,
  ports: Ports
): Promise<RunResult> => {
  const { tracker, git, log } = ports
  const root = await git.repoRoot()
  const paths = runPaths(root, spec)
  for (const dir of [paths.dir, paths.notes, paths.logs]) mkdirSync(dir, { recursive: true })

  const tickets = await tracker.readSpec(spec)
  const branch = integrationBranch(spec)
  const worktree = await prepareIntegration(git, root, branch)

  const state: RunState = loadState(paths.state) ?? {
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

  return { ok: await drive(run, tickets), frontier }
}
