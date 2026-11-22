import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runSpec, type GitPort, type Ports, type Ticket, type TrackerPort } from './run-spec.ts'

/** A fake tracker serving a fixed graph, counting how often it is read. */
const fakeTracker = (tickets: Ticket[]) => {
  const reads: number[] = []
  const tracker: TrackerPort = {
    readSpec: async (spec) => {
      reads.push(spec)
      return tickets
    }
  }
  return { tracker, reads }
}

/** A fake git holding branches and worktrees in memory, with `main` already present. */
const fakeGit = (root: string) => {
  const branches = new Map<string, string>([['main', 'main-tip']])
  const worktrees = new Map<string, string>()
  const added: { path: string; branch: string; base?: string }[] = []
  const git: GitPort = {
    repoRoot: async () => root,
    branchExists: async (branch) => branches.has(branch),
    worktreeFor: async (branch) =>
      [...worktrees].find(([, checkedOut]) => checkedOut === branch)?.[0] ?? null,
    addWorktree: async (path, branch, base) => {
      if (base !== undefined) {
        if (branches.has(branch)) throw new Error(`branch ${branch} already exists`)
        branches.set(branch, branches.get(base) ?? base)
      } else if (!branches.has(branch)) throw new Error(`no branch ${branch}`)
      if (worktrees.has(path)) throw new Error(`worktree ${path} already exists`)
      worktrees.set(path, branch)
      added.push({ path, branch, base })
    }
  }
  return { git, branches, worktrees, added }
}

const ticket = (number: number, blockedBy: Ticket['blockedBy'] = [], open = true): Ticket => ({
  number,
  title: `Ticket ${number}`,
  open,
  blockedBy
})

let root: string
let lines: string[]

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'implement-spec-'))
  lines = []
})

afterEach(() => rmSync(root, { recursive: true, force: true }))

const portsFor = (tickets: Ticket[]) => {
  const tracker = fakeTracker(tickets)
  const git = fakeGit(root)
  const ports: Ports = { tracker: tracker.tracker, git: git.git, log: (line) => lines.push(line) }
  return { ports, tracker, git }
}

const readState = (spec: number) =>
  JSON.parse(readFileSync(join(root, '.implement-spec', String(spec), 'state.json'), 'utf8'))

describe('runSpec', () => {
  it('reports as ready every open ticket whose blockers are all closed on GitHub', async () => {
    const { ports, tracker } = portsFor([
      ticket(1),
      ticket(2, [{ number: 90, open: false }]),
      ticket(3, [{ number: 1, open: true }]),
      ticket(4, [
        { number: 90, open: false },
        { number: 91, open: true }
      ])
    ])

    const result = await runSpec(100, {}, ports)

    expect(result.frontier).toEqual([1, 2])
    expect(tracker.reads).toEqual([100])
    expect(lines.join('\n')).toMatch(/#1\b/)
    expect(lines.join('\n')).toMatch(/#2\b/)
    expect(lines.join('\n')).not.toMatch(/#3\b|#4\b/)
  })

  it('cuts the integration branch from main into its own worktree under the repository root', async () => {
    const { ports, git } = portsFor([ticket(1)])

    await runSpec(100, {}, ports)

    expect(git.added).toHaveLength(1)
    const [worktree] = git.added
    expect(worktree.branch).toBe('implement-spec/100')
    expect(worktree.base).toBe('main')
    expect(worktree.path.startsWith(join(root, '.claude', 'worktrees') + '/')).toBe(true)
  })

  it('writes a state file in the run directory listing every ticket as pending', async () => {
    const { ports } = portsFor([ticket(1), ticket(2, [{ number: 1, open: true }])])

    await runSpec(100, {}, ports)

    const state = readState(100)
    expect(state.spec).toBe(100)
    expect(state.tickets).toEqual({ 1: { status: 'pending' }, 2: { status: 'pending' } })
  })

  it('reuses the branch, worktree and state on a re-run', async () => {
    const { ports, git } = portsFor([ticket(1), ticket(2, [{ number: 1, open: true }])])

    const first = await runSpec(100, {}, ports)
    const stateAfterFirst = readState(100)
    const second = await runSpec(100, {}, ports)

    expect(git.added).toHaveLength(1)
    expect(readState(100)).toEqual(stateAfterFirst)
    expect(second.frontier).toEqual(first.frontier)
  })

  it('reattaches the existing integration branch when its worktree is gone', async () => {
    const { ports, git } = portsFor([ticket(1)])
    git.branches.set('implement-spec/100', 'integration-tip')

    await runSpec(100, {}, ports)

    expect(git.added).toEqual([expect.objectContaining({ branch: 'implement-spec/100' })])
    expect(git.added[0].base).toBeUndefined()
    expect(git.branches.get('implement-spec/100')).toBe('integration-tip')
  })

  it('counts a blocker that is done in the state file as cleared', async () => {
    const { ports } = portsFor([
      ticket(1),
      ticket(2, [{ number: 1, open: true }]),
      ticket(3, [{ number: 2, open: true }])
    ])
    await runSpec(100, {}, ports)
    const statePath = join(root, '.implement-spec', '100', 'state.json')
    const state = readState(100)
    state.tickets[1].status = 'done'
    writeFileSync(statePath, JSON.stringify(state))

    const result = await runSpec(100, {}, ports)

    expect(result.frontier).toEqual([2])
    expect(readState(100).tickets[1].status).toBe('done')
  })
})
