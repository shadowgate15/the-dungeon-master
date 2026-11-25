// Runs a spec's task graph from start (or resume) to finish. Every side effect goes through the
// injected ports, so tests drive whole runs against fakes and a temp repository root.
import { randomUUID } from 'node:crypto'
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync
} from 'node:fs'
import { join } from 'node:path'
import {
  continuePrompt,
  explorerPrompt,
  fixerPrompt,
  implementerPrompt,
  mergerPrompt,
  prWriterPrompt,
  reviewerPrompt,
  type MergeReason,
  type Pointers
} from './prompts.ts'

/** An issue that blocks a ticket, with its state on GitHub. */
export type Blocker = { number: number; open: boolean }

/** One of the spec's open sub-issues, with its native `blocked_by` edges. */
export type Ticket = { number: number; title: string; blockedBy: Blocker[] }

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
  /** Pushes `branch` to `origin`, creating or updating the remote branch of the same name. */
  push: (branch: string) => Promise<void>
  /** Runs `git merge --no-ff <branch>` in the worktree at `worktree` (the integration worktree). */
  merge: (worktree: string, branch: string) => Promise<MergeResult>
  /** Aborts the merge in progress in the worktree at `worktree`; does nothing when there is none. */
  abortMerge: (worktree: string) => Promise<void>
}

/**
 * How a `git merge` ended: committed cleanly, stopped on conflicts in `paths`, or failed some other
 * way with git's `message`.
 */
export type MergeResult =
  | { result: 'clean' }
  | { result: 'conflicts'; paths: string[] }
  | { result: 'error'; message: string }

/** The checks run after a clean git merge, in order: install, lint, type-check and unit tests. */
export type ChecksStep = 'install' | 'lint' | 'check' | 'test'

/** How the checks ended: all passed, or stopped at the first `step` that failed. */
export type ChecksResult = { passed: true } | { passed: false; step: ChecksStep }

export type ChecksPort = {
  /** Runs the checks in `cwd`, stopping at the first failure, with all output appended to `logFile`. */
  run: (run: { cwd: string; logFile: string }) => Promise<ChecksResult>
}

/** The roles a `claude` session can play in a run. */
export type Role = 'explorer' | 'implementer' | 'merger' | 'reviewer' | 'fixer' | 'pr-writer'

/** A Claude model, named by alias so runs follow new releases. */
export type Model = 'sonnet' | 'opus'

/**
 * The model each role's sessions run on: Sonnet for the routine work, Opus where judgment counts
 * (resolving merges, reviewing and fixing).
 */
export const ROLE_MODELS: Record<Role, Model> = {
  explorer: 'sonnet',
  implementer: 'sonnet',
  'pr-writer': 'sonnet',
  merger: 'opus',
  reviewer: 'opus',
  fixer: 'opus'
}

/**
 * One role session on `model`: started with `sessionId`, or resumed by it, in `cwd`, all output to
 * `logFile`.
 */
export type ClaudeSession = {
  role: Role
  model: Model
  cwd: string
  prompt: string
  sessionId: string
  resume: boolean
  logFile: string
}

/**
 * How a session ended: its exit code; `no-session` when it was to be resumed but `claude` has
 * no saved conversation with its ID (the run stopped before `claude` saved it); or
 * `usageLimitResetsAt` (epoch milliseconds) when it stopped because the account hit a usage limit.
 */
export type ClaudeExit = number | 'no-session' | { usageLimitResetsAt: number }

export type ClaudePort = {
  /** Runs one session to its end and resolves to how it ended. */
  run: (session: ClaudeSession) => Promise<ClaudeExit>
}

export type Ports = {
  tracker: TrackerPort
  git: GitPort
  claude: ClaudePort
  checks: ChecksPort
  log: (line: string) => void
  /** The current time, in epoch milliseconds. */
  now: () => number
  /** This process's ID, saved with each run so `--status` can tell whether it is still going. */
  pid: number
  /** Receives the run state after every change, to draw progress from. */
  progress: (state: RunState) => void
  /** Resolves once the clock reaches `time` (epoch milliseconds). */
  waitUntil: (time: number) => Promise<void>
}

/** How long after a usage limit resets the script waits before resuming the session it stopped. */
export const USAGE_LIMIT_GRACE_MS = 60 * 1000

/** Why a session resumed after waiting out a usage limit didn't complete, for its continue prompt. */
const USAGE_LIMIT_REASON = 'it stopped because the Claude usage limit was reached'

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
 * or `no-pr-body` (it wrote no PR body file). An implementer or merger fails `error` when a port
 * call around its session throws.
 */
export type DoneCheck =
  | 'passed'
  | 'nonzero-exit'
  | 'no-commits'
  | 'missing-launch-commit'
  | 'not-merged'
  | 'no-pr-body'
  | 'error'

/**
 * How a session ended: its exit code and the done check the script ran on it, or, for `error`, the
 * thrown error's message (and no exit code when the session never ended).
 */
export type SessionOutcome = { exitCode?: number; check: DoneCheck; error?: string }

/**
 * A role session's ID, saved before it launches, and its outcome once it has ended. Times are epoch
 * milliseconds: `startedAt` and `endedAt` bound its latest attempt, `activeMs` sums the attempts
 * before it, and `attempts` counts every launch of the work, resumes and fresh restarts included.
 * `waitingUntil` is set while the run waits out a usage limit before resuming it.
 */
export type SessionState = {
  id: string
  outcome?: SessionOutcome
  startedAt?: number
  endedAt?: number
  activeMs?: number
  attempts?: number
  waitingUntil?: number
}

export type TicketState = {
  status: TicketStatus
  /** The integration tip the ticket's branch was cut from. */
  launchCommit?: string
  /** The implementer session. */
  session?: SessionState
  /** The merger session that merges the ticket branch into the integration branch. */
  merger?: SessionState
  /** The script's own clean merge of the ticket branch, saved before its checks run. */
  gitMerge?: GitMergeState
  /**
   * The ticket's place in the merge queue: 1 for the first implementer to pass in the spec's runs,
   * 2 for the next, and so on. A re-run queues tickets left `implemented` by it.
   */
  finishOrder?: number
}

/**
 * A clean `git merge` of a ticket branch and the checks after it, in epoch milliseconds: `endedAt`
 * and `checks` are set once the checks end.
 */
export type GitMergeState = { startedAt: number; endedAt?: number; checks?: ChecksResult }

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
  /** Set once the `ready` step has marked the PR ready, so a re-run of that step doesn't again. */
  prReady?: boolean
  /** The spec's open tickets as the latest run read them, so the chart can be drawn without `gh`. */
  graph?: Ticket[]
  /** Each run of the command that did work: when it started, and when it last saved the state. */
  runs?: RunSpan[]
}

/** One run of the command, in epoch milliseconds, and the process that ran it. */
export type RunSpan = { startedAt: number; endedAt: number; pid?: number }

/** Where a spec's run lives: state, notes, logs and the PR body, under the main repository root. */
export const runPaths = (root: string, spec: number) => {
  const dir = join(root, '.implement-spec', String(spec))
  return {
    dir,
    state: join(dir, 'state.json'),
    notes: join(dir, 'notes'),
    logs: join(dir, 'logs'),
    prBody: join(dir, 'pr-body.md'),
    runLog: join(dir, 'run.log')
  }
}

/** The branch the integration branch is cut from and the PR targets. */
const BASE_BRANCH = 'main'

export const integrationBranch = (spec: number) => `implement-spec/${spec}`

export const ticketBranch = (spec: number, ticket: number) => `implement-spec/${spec}-${ticket}`

/** A session's log: `logs/<role>-<ticket#>.log`, or `logs/<role>.log` for a role not tied to a ticket. */
export const logPath = (logs: string, role: Role, ticket?: number) =>
  join(logs, ticket === undefined ? `${role}.log` : `${role}-${ticket}.log`)

/** The log of the checks after a ticket's clean git merge: `logs/checks-<ticket#>.log`. */
export const checksLogPath = (logs: string, ticket: number) => join(logs, `checks-${ticket}.log`)

const worktreePath = (root: string, branch: string) =>
  join(root, '.claude', 'worktrees', branch.replaceAll('/', '-'))

const loadState = (path: string): RunState | null =>
  existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as RunState) : null

const saveState = (path: string, state: RunState) => {
  writeFileSync(`${path}.tmp`, JSON.stringify(state, null, 2) + '\n')
  renameSync(`${path}.tmp`, path)
}

/** The integration branch's worktree: reused when it exists, otherwise created (and the branch cut from the base branch). */
const prepareIntegration = async (git: GitPort, root: string, branch: string) => {
  const existing = await git.worktreeFor(branch)
  if (existing) return existing
  const path = worktreePath(root, branch)
  if (await git.branchExists(branch)) await git.addWorktree(path, branch)
  else await git.addWorktree(path, branch, BASE_BRANCH)
  return path
}

/**
 * A ticket (always open: the tracker reads only open ones) is ready when it is pending and every
 * blocker is closed on GitHub or done in this run.
 */
const readyTickets = (tickets: Ticket[], state: RunState) =>
  tickets
    .filter(
      (ticket) =>
        state.tickets[ticket.number]?.status === 'pending' &&
        ticket.blockedBy.every(
          (blocker) => !blocker.open || state.tickets[blocker.number]?.status === 'done'
        )
    )
    .map((ticket) => ticket.number)

/** A session that didn't complete, so this run will resume it. */
const unfinished = (session: SessionState | undefined) =>
  session !== undefined && session.outcome?.check !== 'passed'

/** How many sessions an earlier run left unfinished: implementers, mergers and steps. */
const unfinishedSessions = (state: RunState) =>
  Object.values(state.tickets).filter(
    (entry) =>
      (unfinishedImplementer(entry) && unfinished(entry.session)) ||
      (entry.status === 'implemented' && unfinished(entry.merger))
  ).length +
  Object.values(state.steps ?? {}).filter(
    (step) => step.status !== 'done' && unfinished(step.session)
  ).length

/** Everything a run's steps share. `save` persists `state`, and is called after every transition. */
type Run = {
  spec: number
  root: string
  paths: ReturnType<typeof runPaths>
  branch: string
  state: RunState
  save: () => void
  /** Prints a console line and appends it, with its time, to run.log. */
  log: (line: string) => void
  ports: Ports
}

/** The recorded state of a step not tied to a ticket, once it has started. */
const stepState = (run: Run, name: StepName) => run.state.steps?.[name]

const stepDone = (run: Run, name: StepName) => stepState(run, name)?.status === 'done'

const pointers = (run: Run): Pointers => ({
  spec: run.spec,
  integrationBranch: run.branch,
  notes: run.paths.notes
})

/** Why a session didn't complete, as its continue prompt states it. */
const unfinishedReason = ({ outcome }: SessionState) => {
  if (outcome === undefined) return 'it was interrupted, as the run stopped while it was running'
  if (outcome.check === 'nonzero-exit') return `it exited with code ${outcome.exitCode}`
  if (outcome.check === 'error') return `the script hit an error around it: ${outcome.error}`
  return `it exited ${outcome.exitCode} but failed the done check: ${outcome.check}`
}

/**
 * The session to run in place of `previous`: `previous` itself, resumed with a continue prompt
 * naming why it didn't complete, or a fresh session with a new ID when there is none to resume.
 * A resumed session's old outcome is cleared, so an interruption now reads as one.
 */
const nextSession = (previous: SessionState | undefined, prompt: string) => {
  if (previous === undefined || previous.outcome?.check === 'passed') {
    return { session: { id: randomUUID() } as SessionState, resume: false, prompt, reason: '' }
  }
  const reason = unfinishedReason(previous)
  delete previous.outcome
  return { session: previous, resume: true, prompt: continuePrompt(reason, prompt), reason }
}

/** A ticket whose implementer didn't complete: left `running` by a stopped run, or `failed`. */
const unfinishedImplementer = (entry: TicketState) =>
  entry.status === 'running' || entry.status === 'failed'

/** An unfinished implementer whose session can be resumed against its launch commit. */
const resumableImplementer = (entry: TicketState) =>
  unfinishedImplementer(entry) && entry.session !== undefined && entry.launchCommit !== undefined

/** The done check every session starts with: a non-zero exit fails it, otherwise `rest` decides. */
const exited = async (
  exitCode: number,
  rest: () => Promise<DoneCheck> = async () => 'passed'
): Promise<DoneCheck> => (exitCode !== 0 ? 'nonzero-exit' : rest())

/** Every session in the run state. */
const allSessions = (state: RunState) =>
  [
    ...Object.values(state.tickets).flatMap((entry) => [entry.session, entry.merger]),
    ...Object.values(state.steps ?? {}).map((step) => step.session)
  ].filter((session): session is SessionState => session !== undefined)

/**
 * Ends the attempts a stopped run left open (mid-attempt or waiting out a usage limit) at that
 * run's last save, the latest time it is known to have been going.
 */
const closeStopped = (state: RunState) => {
  const lastSave = state.runs?.at(-1)?.endedAt
  for (const session of allSessions(state)) {
    delete session.waitingUntil
    if (session.startedAt !== undefined && session.endedAt === undefined) {
      session.endedAt = Math.max(session.startedAt, lastSave ?? session.startedAt)
    }
  }
}

/** Starts a new attempt of `session` at `now`, folding its previous attempt into `activeMs`. */
const beginAttempt = (session: SessionState, now: number) => {
  const { startedAt, endedAt } = session
  if (startedAt !== undefined && endedAt !== undefined) {
    session.activeMs = (session.activeMs ?? 0) + (endedAt - startedAt)
  }
  session.attempts = (session.attempts ?? 0) + 1
  session.startedAt = now
  delete session.endedAt
}

/** One role session, as `runSession` runs it. */
type SessionSpec = {
  role: Role
  /** The ticket the session works on, for its log name and console lines. */
  ticket?: number
  cwd: string
  prompt: string
  /** The session that ran this work in an earlier run, if any. */
  previous: SessionState | undefined
  /** Puts the session about to run into the run state; `runSession` saves it before launching. */
  record: (session: SessionState) => void
  /** Runs once the session is saved and before it launches, such as adding its worktree. */
  prepare?: () => Promise<void>
  /** The done check on the session's exit code. */
  check: (exitCode: number) => Promise<DoneCheck>
  /** Applies the done check's result to the run state; `runSession` saves it afterwards. */
  settle: (check: DoneCheck) => void
}

/**
 * The sequence every role session shares: the earlier session resumed with a continue prompt when
 * it didn't complete, otherwise a fresh one, its ID saved before it launches; then the done check,
 * recorded as the session's outcome and saved. Prints one line on launch and one on a failed
 * check. Resolves to whether the check passed.
 */
const runSession = async (run: Run, spec: SessionSpec): Promise<boolean> => {
  const { claude } = run.ports
  const { log } = run
  const logFile = logPath(run.paths.logs, spec.role, spec.ticket)
  const label = spec.ticket === undefined ? spec.role : `#${spec.ticket} ${spec.role}`
  const next = nextSession(spec.previous, spec.prompt)
  let { session } = next
  spec.record(session)
  run.save()
  await spec.prepare?.()
  beginAttempt(session, run.ports.now())
  run.save()

  log(
    next.resume
      ? `resumed ${label} because ${next.reason} (log ${logFile})`
      : `launched ${label} (log ${logFile})`
  )
  const launch = (resume: boolean, prompt: string) =>
    claude.run({
      role: spec.role,
      model: ROLE_MODELS[spec.role],
      cwd: spec.cwd,
      prompt,
      sessionId: session.id,
      resume,
      logFile
    })
  let resume = next.resume
  let prompt = next.prompt
  let exitCode: number
  for (;;) {
    const exit = await launch(resume, prompt)
    session.endedAt = run.ports.now()
    if (exit === 'no-session' && resume) {
      // The run stopped before claude saved the session: start a fresh one with the same continue
      // prompt, as its directory may hold work the lost session did.
      const { startedAt, endedAt, activeMs, attempts } = session
      session = { id: randomUUID(), startedAt, endedAt, activeMs, attempts }
      beginAttempt(session, run.ports.now())
      spec.record(session)
      run.save()
      log(`no saved session to resume for ${label}, launched fresh (log ${logFile})`)
      resume = false
      continue
    }
    if (typeof exit === 'object') {
      // The account hit a usage limit: wait for it to reset, then resume the same session.
      const until = exit.usageLimitResetsAt + USAGE_LIMIT_GRACE_MS
      log(
        `usage limit hit by ${label}, waiting until ${new Date(until).toLocaleString()} to resume`
      )
      session.waitingUntil = until
      run.save()
      await run.ports.waitUntil(until)
      delete session.waitingUntil
      beginAttempt(session, run.ports.now())
      run.save()
      log(`resumed ${label} after the usage limit reset (log ${logFile})`)
      resume = true
      prompt = continuePrompt(USAGE_LIMIT_REASON, spec.prompt)
      continue
    }
    exitCode = exit === 'no-session' ? 1 : exit
    break
  }

  const check = await spec.check(exitCode)
  session.outcome = { exitCode, check }
  spec.settle(check)
  run.save()
  if (check !== 'passed') log(`failed ${label}: ${check} (log ${logFile})`)
  return check === 'passed'
}

/**
 * Runs one role session for a step in the integration worktree, unless an earlier run finished
 * the step: the step's earlier session resumed when it didn't complete, otherwise a fresh one. It
 * passes on exit 0, with `check` deciding beyond that. Resolves to whether the step is done.
 */
const sessionStep = async (
  run: Run,
  name: StepName,
  role: Role,
  prompt: string,
  check?: () => Promise<DoneCheck>
): Promise<boolean> => {
  if (stepDone(run, name)) return true
  const step: StepState = { status: 'running' }
  return runSession(run, {
    role,
    cwd: run.state.integrationWorktree,
    prompt,
    previous: stepState(run, name)?.session,
    record: (session) => {
      step.session = session
      run.state.steps = { ...run.state.steps, [name]: step }
    },
    check: (exitCode) => exited(exitCode, check),
    settle: (result) => {
      step.status = result === 'passed' ? 'done' : 'failed'
    }
  })
}

/** Runs the explorer, unless an earlier run finished exploring. Resolves to whether exploration is done. */
const explore = async (run: Run): Promise<boolean> => {
  const done = await sessionStep(run, 'explore', 'explorer', explorerPrompt(pointers(run)))
  if (done) run.log(`explored (notes ${run.paths.notes})`)
  return done
}

/**
 * Runs the ticket's implementer and applies the done check: it exited 0, and its branch has
 * commits beyond the launch commit and still contains it. A ticket whose implementer didn't
 * complete in an earlier run goes back to `running` and has that session resumed in its worktree,
 * against its original launch commit. Otherwise the ticket's branch and worktree are cut from the
 * integration tip and a fresh implementer runs there. Resolves to whether the ticket passed.
 */
const implement = async (run: Run, ticket: number): Promise<boolean> => {
  const { git } = run.ports
  const { log } = run
  const branch = ticketBranch(run.spec, ticket)
  const cwd = worktreePath(run.root, branch)
  const previous = run.state.tickets[ticket]
  const resumable = resumableImplementer(previous) && (await git.branchExists(branch))
  const launchCommit = resumable ? (previous.launchCommit as string) : await git.head(run.branch)
  const entry: TicketState = { ...previous, status: 'running', launchCommit }
  const passed = await runSession(run, {
    role: 'implementer',
    ticket,
    cwd,
    prompt: implementerPrompt(pointers(run), { ticket, branch }),
    previous: resumable ? previous.session : undefined,
    record: (session) => {
      entry.session = session
      run.state.tickets[ticket] = entry
    },
    prepare: async () => {
      if (!resumable) await git.addWorktree(cwd, branch, launchCommit)
      else if ((await git.worktreeFor(branch)) === null) await git.addWorktree(cwd, branch)
    },
    check: (exitCode) =>
      exited(exitCode, async () => {
        if (!(await git.hasCommitsBeyond(branch, launchCommit))) return 'no-commits'
        if (!(await git.contains(branch, launchCommit))) return 'missing-launch-commit'
        return 'passed'
      }),
    settle: (check) => {
      entry.status = check === 'passed' ? 'implemented' : 'failed'
      if (check === 'passed') {
        const orders = Object.values(run.state.tickets).map(({ finishOrder }) => finishOrder ?? 0)
        entry.finishOrder = Math.max(0, ...orders) + 1
      }
    }
  })
  if (passed) log(`implemented #${ticket}`)
  return passed
}

/** The minimal PR body: `Closes #<spec>`, then one `Closes #<ticket>` line per ticket in the run. */
const closesBody = (run: Run) =>
  [run.spec, ...Object.keys(run.state.tickets).map(Number)]
    .map((number) => `Closes #${number}`)
    .join('\n')

/**
 * Pushes the integration branch, so the PR shows its latest commits, then opens the draft PR from
 * it, unless this or an earlier run already did.
 */
const publish = async (run: Run) => {
  await run.ports.git.push(run.branch)
  if (run.state.pr !== undefined) return
  run.state.pr = await run.ports.tracker.openDraftPr({
    head: run.branch,
    base: BASE_BRANCH,
    title: `feat: implement spec #${run.spec}`,
    body: closesBody(run)
  })
  run.save()
  run.log(`opened draft PR #${run.state.pr}`)
}

/**
 * Merges an implemented ticket's branch into the integration branch. A ticket with an earlier
 * merger session has it resumed, with no git attempt. A ticket the integration branch already
 * contains (an earlier run was stopped during its checks) goes straight to the checks. Otherwise
 * the script runs `git merge` itself: a clean merge goes on to the checks, with no session;
 * conflicts or any other error are aborted and handed to a merger, told why. Resolves to whether
 * the merge passed.
 */
const merge = async (run: Run, ticket: number): Promise<boolean> => {
  const { git } = run.ports
  const branch = ticketBranch(run.spec, ticket)
  const entry = run.state.tickets[ticket]
  if (entry.merger !== undefined) return mergeBySession(run, ticket)
  const startedAt = run.ports.now()
  if (await git.contains(run.branch, await git.head(branch))) {
    run.log(`#${ticket} is already merged, running its checks`)
    return checkGitMerge(run, ticket, entry.gitMerge?.startedAt ?? startedAt)
  }
  const merged = await git.merge(run.state.integrationWorktree, branch)
  if (merged.result === 'clean') return checkGitMerge(run, ticket, startedAt)
  await git.abortMerge(run.state.integrationWorktree)
  if (merged.result === 'conflicts') {
    run.log(
      `git merge of #${ticket} conflicted in ${merged.paths.join(', ')}, handing it to a merger`
    )
    return mergeBySession(run, ticket, { conflicts: merged.paths })
  }
  run.log(`git merge of #${ticket} failed: ${merged.message}, handing it to a merger`)
  return mergeBySession(run, ticket, { error: merged.message })
}

/** Marks a merged ticket `done`, removes its worktree and publishes the integration branch. */
const merged = async (run: Run, ticket: number, how: string) => {
  run.state.tickets[ticket].status = 'done'
  run.save()
  await run.ports.git.removeWorktree(worktreePath(run.root, ticketBranch(run.spec, ticket)))
  run.log(`merged #${ticket}${how}`)
  await publish(run)
}

/**
 * Records a clean git merge of the ticket (saved before the checks start), then runs the checks in
 * the integration worktree. Passing checks mark the ticket `done`, with no session; failing ones
 * leave it `implemented` and fail the merge. Resolves to whether the merge passed.
 */
const checkGitMerge = async (run: Run, ticket: number, startedAt: number): Promise<boolean> => {
  const entry = run.state.tickets[ticket]
  const record: GitMergeState = { startedAt }
  entry.gitMerge = record
  run.save()
  const logFile = checksLogPath(run.paths.logs, ticket)
  const checks = await run.ports.checks.run({ cwd: run.state.integrationWorktree, logFile })
  record.endedAt = run.ports.now()
  record.checks = checks
  run.save()
  if (!checks.passed) {
    run.log(`failed #${ticket} checks after its git merge: ${checks.step} (log ${logFile})`)
    return false
  }
  await merged(run, ticket, ' by git, checks passed')
  return true
}

/**
 * Runs a merger in the integration worktree to merge an implemented ticket's branch: the ticket's
 * earlier merger resumed when it didn't complete, otherwise a fresh one, told `reason` the script's
 * git merge didn't land. It passes when it exits 0 and the integration branch contains the ticket
 * branch's head. On a pass the ticket is `done`, its worktree removed and the integration branch
 * published; on a failure it stays `implemented`, with the merger's outcome recorded. Resolves to
 * whether the merge passed.
 */
const mergeBySession = async (run: Run, ticket: number, reason?: MergeReason): Promise<boolean> => {
  const { git } = run.ports
  const branch = ticketBranch(run.spec, ticket)
  const ticketHead = await git.head(branch)
  const entry = run.state.tickets[ticket]
  const passed = await runSession(run, {
    role: 'merger',
    ticket,
    cwd: run.state.integrationWorktree,
    prompt: mergerPrompt(pointers(run), { ticket, branch, reason }),
    previous: entry.merger,
    record: (session) => {
      entry.merger = session
    },
    check: (exitCode) =>
      exited(exitCode, async () =>
        (await git.contains(run.branch, ticketHead)) ? 'passed' : 'not-merged'
      ),
    settle: (check) => {
      if (check === 'passed') entry.status = 'done'
    }
  })
  if (!passed) return false
  await merged(run, ticket, '')
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
  const described = async (): Promise<DoneCheck> => (existsSync(bodyFile) ? 'passed' : 'no-pr-body')
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
 * The `ready` step: pushes the integration branch (with the fixer's commits), appends any missing
 * `Closes` lines to the PR body file, replaces the PR body from it, marks the PR ready and removes
 * the integration worktree (the branch is kept). Each part is safe to repeat, and marking the PR ready is recorded, so a re-run after a throw part-way
 * through finishes the step.
 */
const markReady = async (run: Run): Promise<boolean> => {
  if (stepDone(run, 'ready')) return true
  const { tracker, git } = run.ports
  const { log } = run
  await publish(run)
  const pr = run.state.pr as number
  const bodyFile = run.paths.prBody
  writeFileSync(bodyFile, withCloses(run, readFileSync(bodyFile, 'utf8')))
  await tracker.setPrBody(pr, bodyFile)
  if (!run.state.prReady) {
    await tracker.markPrReady(pr)
    run.state.prReady = true
    run.save()
  }
  await git.removeWorktree(run.state.integrationWorktree)
  run.state.steps = { ...run.state.steps, ready: { status: 'done' } }
  run.save()
  log(`PR #${pr} ready`)
  return true
}

/**
 * Runs a ticket's implementer or merger, turning a throw from a port call around the session into
 * a failure of that session with the `error` check, so the rest of the run carries on: the ticket
 * is `failed` (implementer) or stays `implemented` with the merger's outcome recorded (merger).
 * When the throw came before the session's ID was saved, the outcome goes on a new ID that never
 * ran; a re-run finds no saved session for it and starts a fresh one.
 */
const contain = async (
  run: Run,
  ticket: number,
  role: 'implementer' | 'merger',
  work: (run: Run, ticket: number) => Promise<boolean>
): Promise<boolean> => {
  try {
    return await work(run, ticket)
  } catch (thrown) {
    const error = thrown instanceof Error ? thrown.message : String(thrown)
    const entry = run.state.tickets[ticket]
    const key = role === 'implementer' ? 'session' : 'merger'
    entry[key] = { id: entry[key]?.id ?? randomUUID(), outcome: { check: 'error', error } }
    if (role === 'implementer') entry.status = 'failed'
    run.save()
    const logFile = logPath(run.paths.logs, role, ticket)
    run.log(`failed #${ticket} ${role}: error: ${error} (log ${logFile})`)
    return false
  }
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

  /** Tickets an earlier run left that `keep` picks, in the order their implementers finished. */
  const earlier = (keep: (entry: TicketState) => boolean) =>
    Object.entries(run.state.tickets)
      .filter(([, entry]) => keep(entry))
      .sort(([, a], [, b]) => (a.finishOrder ?? 0) - (b.finishOrder ?? 0))
      .map(([key]) => Number(key))

  for (const ticket of earlier((entry) => entry.status === 'implemented' && !!entry.merger)) {
    if (!(await contain(run, ticket, 'merger', merge))) return false
  }
  queue.push(...earlier((entry) => entry.status === 'implemented'))
  const resumable = earlier(unfinishedImplementer)

  const step = () => {
    if (halted) return
    for (const ticket of [...resumable.splice(0), ...readyTickets(tickets, run.state)]) {
      if (launched.has(ticket)) continue
      launched.add(ticket)
      track(
        contain(run, ticket, 'implementer', implement).then((passed) => {
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
      contain(run, next, 'merger', merge).then((merged) => {
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
 * `failed` ticket's implementer, or the merger of an `implemented` ticket whose merge failed, or
 * the failed checks step and checks log of one whose git merge failed its checks.
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
    if (entry.status !== 'implemented') return []
    const checks = entry.gitMerge?.checks
    if (entry.merger === undefined && checks?.passed === false) {
      return [`  #${ticket} checks ${checks.step} (log ${checksLogPath(run.paths.logs, ticket)})`]
    }
    return failed('merger', entry.merger)
  })
  if (failures.length === 0) return
  run.log('failed tickets:')
  for (const line of failures) run.log(line)
}

/**
 * After a drive with no failure, prints every open ticket that isn't `done`, ascending, with the
 * blockers that kept it from launching: open on GitHub and not done in this run (a blocker outside
 * the spec, or a stuck ticket). Tickets closed on GitHub since an earlier run aren't read, so they
 * never count. Resolves to whether any ticket was stuck.
 */
/** A ticket's blockers still open on GitHub and not yet `done` in the run, by number. */
export const openBlockers = ({ blockedBy }: Pick<Ticket, 'blockedBy'>, state: RunState) =>
  blockedBy
    .filter((blocker) => blocker.open && state.tickets[blocker.number]?.status !== 'done')
    .map((blocker) => blocker.number)

const reportStuck = (run: Run, tickets: Ticket[]) => {
  const stuck = tickets
    .filter(({ number }) => run.state.tickets[number]?.status !== 'done')
    .sort((a, b) => a.number - b.number)
  if (stuck.length === 0) return false
  run.log('stuck tickets:')
  for (const { number, blockedBy } of stuck) {
    const blockers = openBlockers({ blockedBy }, run.state).map((blocker) => `#${blocker}`)
    run.log(`  #${number} blocked by ${blockers.join(', ')}`)
  }
  return true
}

export const runSpec = async (
  spec: number,
  options: RunOptions,
  ports: Ports
): Promise<RunResult> => {
  const { tracker, git } = ports
  const root = await git.repoRoot()
  const paths = runPaths(root, spec)
  for (const dir of [paths.dir, paths.notes, paths.logs]) mkdirSync(dir, { recursive: true })
  const appendRunLog = (line: string) =>
    appendFileSync(paths.runLog, `${new Date(ports.now()).toISOString()} ${line}\n`)
  const log = (line: string) => {
    appendRunLog(line)
    ports.log(line)
  }

  const saved = loadState(paths.state)
  const resuming = saved ? unfinishedSessions(saved) : 0
  appendRunLog(
    `--- run started${resuming > 0 ? `, resume of ${resuming} session${resuming === 1 ? '' : 's'}` : ''}`
  )
  if (saved?.steps?.ready?.status === 'done') {
    log(`spec #${spec} already finished: PR #${saved.pr} is ready`)
    ports.progress(saved)
    return { ok: true, frontier: [] }
  }

  const tickets = await tracker.readSpec(spec)
  if (tickets.length === 0) {
    log(`spec #${spec} has no open tickets`)
    return { ok: false, frontier: [] }
  }
  const branch = integrationBranch(spec)
  const worktree = await prepareIntegration(git, root, branch)

  const state: RunState = saved ?? {
    spec,
    integrationBranch: branch,
    integrationWorktree: worktree,
    tickets: {}
  }
  state.integrationWorktree = worktree
  state.graph = tickets
  closeStopped(state)
  const startedAt = ports.now()
  state.runs = [...(state.runs ?? []), { startedAt, endedAt: startedAt, pid: ports.pid }]
  for (const ticket of tickets) state.tickets[ticket.number] ??= { status: 'pending' }
  const span = state.runs[state.runs.length - 1]
  const save = () => {
    span.endedAt = ports.now()
    saveState(paths.state, state)
    ports.progress(state)
  }
  const run: Run = { spec, root, paths, branch, state, save, log, ports }
  save()

  if (options.explore && !(await explore(run))) return { ok: false, frontier: [] }

  const frontier = readyTickets(tickets, state)
  for (const ticket of tickets.filter(({ number }) => frontier.includes(number))) {
    log(`ready #${ticket.number} ${ticket.title}`)
  }
  if (frontier.length === 0) log('nothing is ready')

  const ok = await drive(run, tickets)
  reportFailures(run)
  if (!ok) return { ok, frontier }
  if (reportStuck(run, tickets)) return { ok: false, frontier }
  return { ok: await finish(run), frontier }
}
