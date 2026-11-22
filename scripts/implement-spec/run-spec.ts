// Runs a spec's task graph from start (or resume) to finish. Every side effect goes through the
// injected ports, so tests drive whole runs against fakes and a temp repository root.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

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
}

export type Ports = { tracker: TrackerPort; git: GitPort; log: (line: string) => void }

export type RunOptions = { explore?: boolean }

export type RunResult = { ok: boolean; frontier: number[] }

export type TicketStatus = 'pending' | 'running' | 'done' | 'failed'

export type TicketState = { status: TicketStatus }

/** The run's persisted state, rewritten after every transition. */
export type RunState = {
  spec: number
  integrationBranch: string
  integrationWorktree: string
  tickets: Record<number, TicketState>
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

export const runSpec = async (
  spec: number,
  _options: RunOptions,
  { tracker, git, log }: Ports
): Promise<RunResult> => {
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
  saveState(paths.state, state)

  const frontier = readyTickets(tickets, state)
  for (const ticket of tickets.filter(({ number }) => frontier.includes(number))) {
    log(`ready #${ticket.number} ${ticket.title}`)
  }
  if (frontier.length === 0) log('nothing is ready')
  return { ok: true, frontier }
}
