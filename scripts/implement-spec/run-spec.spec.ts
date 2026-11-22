import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  runSpec,
  type ClaudePort,
  type GitPort,
  type Ports,
  type Ticket,
  type TrackerPort
} from './run-spec.ts'

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

/**
 * A fake git holding branches, worktrees and a commit graph in memory, with `main` already present.
 * Each commit records its parents, so ancestry answers come from the graph the way real git's do.
 */
const fakeGit = (root: string) => {
  const parents = new Map<string, string[]>([['main-tip', []]])
  const branches = new Map<string, string>([['main', 'main-tip']])
  const worktrees = new Map<string, string>()
  const added: { path: string; branch: string; base?: string }[] = []
  const removed: string[] = []
  let made = 0
  const ancestry = (commit: string) => {
    const seen = new Set<string>()
    const walk = (at: string) => {
      if (seen.has(at)) return
      seen.add(at)
      for (const parent of parents.get(at) ?? []) walk(parent)
    }
    walk(commit)
    return seen
  }
  const tip = (branch: string) => {
    const at = branches.get(branch)
    if (at === undefined) throw new Error(`no branch ${branch}`)
    return at
  }
  /** Adds a commit to `branch`, with `from`'s tip as a second parent when given (a merge). */
  const commit = (branch: string, from?: string) => {
    const id = `c${++made}`
    parents.set(id, from === undefined ? [tip(branch)] : [tip(branch), tip(from)])
    branches.set(branch, id)
    return id
  }
  const git: GitPort = {
    head: async (branch) => tip(branch),
    hasCommitsBeyond: async (branch, base) => {
      const behind = ancestry(base)
      return [...ancestry(tip(branch))].some((at) => !behind.has(at))
    },
    contains: async (branch, commit) => ancestry(tip(branch)).has(commit),
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
    },
    removeWorktree: async (path) => {
      if (!worktrees.delete(path)) throw new Error(`no worktree at ${path}`)
      removed.push(path)
    }
  }
  return { git, branches, worktrees, added, removed, commit }
}

type FakeGit = ReturnType<typeof fakeGit>
type Session = Parameters<ClaudePort['run']>[0]
/** How a fake session behaves: it may act on the fake git as a real one would, and returns its exit code. */
type Behave = (session: Session, git: FakeGit) => number | Promise<number>

/** A fake claude answering every session with `behave`, recording each call. */
const fakeClaude = (git: FakeGit, behave: Behave) => {
  const sessions: Session[] = []
  const claude: ClaudePort = {
    run: async (session) => {
      sessions.push(session)
      return behave(session, git)
    }
  }
  return { claude, sessions }
}

const checkedOut = (session: Session, git: FakeGit) => {
  const branch = git.worktrees.get(session.cwd)
  if (branch === undefined) throw new Error(`no worktree at ${session.cwd}`)
  return branch
}

/** An implementer that commits on the branch checked out in its directory and exits 0. */
const implementsCleanly: Behave = (session, git) => {
  git.commit(checkedOut(session, git))
  return 0
}

/** A merger that merges the ticket branch its prompt names into the branch in its directory, and exits 0. */
const mergesCleanly: Behave = (session, git) => {
  const ticketBranch = session.prompt.match(/implement-spec\/\d+-\d+/)?.[0]
  if (ticketBranch === undefined) throw new Error('merger prompt names no ticket branch')
  git.commit(checkedOut(session, git), ticketBranch)
  return 0
}

/** Every role succeeds: implementers commit, mergers merge. */
const succeeds: Behave = (session, git) =>
  session.role === 'merger' ? mergesCleanly(session, git) : implementsCleanly(session, git)

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

const portsFor = (tickets: Ticket[], behave: Behave = succeeds) => {
  const tracker = fakeTracker(tickets)
  const git = fakeGit(root)
  const claude = fakeClaude(git, behave)
  const ports: Ports = {
    tracker: tracker.tracker,
    git: git.git,
    claude: claude.claude,
    log: (line) => lines.push(line)
  }
  return { ports, tracker, git, claude }
}

const integrationWorktrees = (git: FakeGit) =>
  git.added.filter(({ branch }) => branch === 'implement-spec/100')

const readState = (spec: number) =>
  JSON.parse(readFileSync(join(root, '.implement-spec', String(spec), 'state.json'), 'utf8'))

describe('runSpec', () => {
  it('reports as ready every open ticket whose blockers are all closed on GitHub', async () => {
    const { ports, tracker } = portsFor([
      ticket(1),
      ticket(2, [{ number: 90, open: false }]),
      ticket(3, [{ number: 91, open: true }]),
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

    const [worktree, ...others] = integrationWorktrees(git)
    expect(others).toEqual([])
    expect(worktree.base).toBe('main')
    expect(worktree.path.startsWith(join(root, '.claude', 'worktrees') + '/')).toBe(true)
  })

  it('writes a state file in the run directory listing every ticket as pending', async () => {
    const { ports } = portsFor([
      ticket(1, [{ number: 90, open: true }]),
      ticket(2, [{ number: 1, open: true }])
    ])

    await runSpec(100, {}, ports)

    const state = readState(100)
    expect(state.spec).toBe(100)
    expect(state.tickets).toEqual({ 1: { status: 'pending' }, 2: { status: 'pending' } })
  })

  it('reuses the branch, worktree and state on a re-run', async () => {
    const { ports, git } = portsFor([
      ticket(1, [{ number: 90, open: true }]),
      ticket(2, [{ number: 1, open: true }])
    ])

    const first = await runSpec(100, {}, ports)
    const stateAfterFirst = readState(100)
    const second = await runSpec(100, {}, ports)

    expect(integrationWorktrees(git)).toHaveLength(1)
    expect(readState(100)).toEqual(stateAfterFirst)
    expect(second.frontier).toEqual(first.frontier)
  })

  it('reattaches the existing integration branch when its worktree is gone', async () => {
    const { ports, git } = portsFor([ticket(1)])
    git.branches.set('implement-spec/100', 'integration-tip')

    await runSpec(100, {}, ports)

    expect(integrationWorktrees(git)).toEqual([
      expect.objectContaining({ branch: 'implement-spec/100' })
    ])
    expect(integrationWorktrees(git)[0].base).toBeUndefined()
    expect(await git.git.contains('implement-spec/100', 'integration-tip')).toBe(true)
  })

  it('counts a blocker that is done in the state file as cleared', async () => {
    const { ports } = portsFor([
      ticket(1, [{ number: 90, open: true }]),
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

  describe('implementing the first ready ticket', () => {
    it('cuts the ticket its own branch and worktree from the integration tip, recording the launch commit before the session starts', async () => {
      let stateAtLaunch: ReturnType<typeof readState> | undefined
      const { ports, git } = portsFor([ticket(1)], (session, fake) => {
        if (session.role === 'implementer') stateAtLaunch = readState(100)
        return succeeds(session, fake)
      })
      git.branches.set('implement-spec/100', 'integration-tip')

      await runSpec(100, {}, ports)

      const worktree = git.added.find(({ branch }) => branch === 'implement-spec/100-1')
      expect(worktree).toEqual({
        path: join(root, '.claude', 'worktrees', 'implement-spec-100-1'),
        branch: 'implement-spec/100-1',
        base: 'integration-tip'
      })
      expect(stateAtLaunch?.tickets[1]).toMatchObject({
        status: 'running',
        launchCommit: 'integration-tip'
      })
    })

    it('runs a fresh implementer session in the ticket worktree with a prompt pointing at the ticket, branches and notes', async () => {
      const { ports, claude } = portsFor([ticket(7)])

      await runSpec(100, {}, ports)

      const runDir = join(root, '.implement-spec', '100')
      const implementers = claude.sessions.filter(({ role }) => role === 'implementer')
      expect(implementers).toEqual([
        expect.objectContaining({
          role: 'implementer',
          cwd: join(root, '.claude', 'worktrees', 'implement-spec-100-7'),
          resume: false,
          logFile: join(runDir, 'logs', 'implementer-7.log')
        })
      ])
      const [{ prompt }] = implementers
      expect(prompt).toMatch(/#100\b/)
      expect(prompt).toMatch(/#7\b/)
      expect(prompt).toContain('implement-spec/100-7')
      expect(prompt).toMatch(/implement-spec\/100(?![-\d])/)
      expect(prompt).toContain(join(runDir, 'notes'))
      expect(prompt).toMatch(/\btdd\b/)
    })

    it('saves the session ID in the state file before the session starts', async () => {
      let stateAtLaunch: ReturnType<typeof readState> | undefined
      const { ports, claude } = portsFor([ticket(1)], (session, fake) => {
        if (session.role === 'implementer') stateAtLaunch = readState(100)
        return succeeds(session, fake)
      })

      await runSpec(100, {}, ports)

      const [{ sessionId }] = claude.sessions.filter(({ role }) => role === 'implementer')
      expect(sessionId).toMatch(/^[0-9a-f-]{36}$/)
      expect(stateAtLaunch?.tickets[1].session).toEqual({ id: sessionId })
    })

    it('moves the ticket on to merging when the done check passes, with one console line per event', async () => {
      const { ports } = portsFor([ticket(1)])

      await runSpec(100, {}, ports)

      expect(readState(100).tickets[1]).toMatchObject({
        session: { outcome: { exitCode: 0, check: 'passed' } }
      })
      const events = lines.filter((line) => /#1\b/.test(line))
      expect(events).toEqual([
        expect.stringMatching(/ready/),
        expect.stringMatching(/launched.*implementer/),
        expect.stringMatching(/implemented/),
        expect.stringMatching(/launched.*merger/),
        expect.stringMatching(/merged/)
      ])
      expect(events[1]).toContain(join(root, '.implement-spec', '100', 'logs', 'implementer-1.log'))
    })

    const failures: [string, Behave][] = [
      ['nonzero-exit', (session, fake) => (implementsCleanly(session, fake), 1)],
      ['no-commits', () => 0],
      [
        'missing-launch-commit',
        (session, fake) => {
          fake.branches.set(fake.worktrees.get(session.cwd) ?? '', 'unrelated-commit')
          return 0
        }
      ]
    ]

    it.each(failures)(
      'marks the ticket failed when the done check finds %s, naming the log',
      async (check, behave) => {
        const { ports } = portsFor([ticket(1)], behave)

        const result = await runSpec(100, {}, ports)

        expect(result.ok).toBe(false)
        expect(readState(100).tickets[1]).toMatchObject({
          status: 'failed',
          session: { outcome: { check } }
        })
        const failed = lines.find((line) => /failed/.test(line))
        expect(failed).toMatch(/#1\b/)
        expect(failed).toContain(check)
        expect(failed).toContain(join(root, '.implement-spec', '100', 'logs', 'implementer-1.log'))
      }
    )
  })

  describe('merging implemented tickets', () => {
    it('runs a linear chain from first ticket to last, merging each before launching the next', async () => {
      const { ports, claude, git } = portsFor([
        ticket(3, [{ number: 2, open: true }]),
        ticket(1, [{ number: 90, open: false }]),
        ticket(2, [{ number: 1, open: true }])
      ])

      const result = await runSpec(100, {}, ports)

      expect(result.ok).toBe(true)
      expect(claude.sessions.map(({ role, logFile }) => [role, logFile])).toEqual(
        [1, 2, 3].flatMap((n) => [
          ['implementer', join(root, '.implement-spec', '100', 'logs', `implementer-${n}.log`)],
          ['merger', join(root, '.implement-spec', '100', 'logs', `merger-${n}.log`)]
        ])
      )
      const state = readState(100)
      expect([1, 2, 3].map((n) => state.tickets[n].status)).toEqual(['done', 'done', 'done'])
      for (const n of [1, 2, 3]) {
        expect(
          await git.git.contains(
            'implement-spec/100',
            git.branches.get(`implement-spec/100-${n}`) ?? ''
          )
        ).toBe(true)
      }
    })

    it('runs the merger in the integration worktree with its session ID saved first, then removes the ticket worktree', async () => {
      let stateAtMerge: ReturnType<typeof readState> | undefined
      let ticketWorktreeAtMerge: string | undefined
      const { ports, claude, git } = portsFor([ticket(1)], (session, fake) => {
        if (session.role === 'merger') {
          stateAtMerge = readState(100)
          ticketWorktreeAtMerge = fake.worktrees.get(
            join(root, '.claude', 'worktrees', 'implement-spec-100-1')
          )
        }
        return succeeds(session, fake)
      })

      await runSpec(100, {}, ports)

      const merger = claude.sessions.find(({ role }) => role === 'merger')
      const [integration] = integrationWorktrees(git)
      expect(merger).toMatchObject({ cwd: integration.path, resume: false })
      expect(merger?.prompt).toContain('implement-spec/100-1')
      expect(merger?.sessionId).not.toBe(claude.sessions[0].sessionId)
      expect(stateAtMerge?.tickets[1].merger).toEqual({ id: merger?.sessionId })
      expect(ticketWorktreeAtMerge).toBe('implement-spec/100-1')
      expect(git.removed).toEqual([join(root, '.claude', 'worktrees', 'implement-spec-100-1')])
      expect(git.worktrees.has(integration.path)).toBe(true)
      expect(readState(100).tickets[1]).toMatchObject({
        status: 'done',
        merger: { outcome: { exitCode: 0, check: 'passed' } }
      })
    })

    const mergerFailures: [string, Behave][] = [
      ['nonzero-exit', (session, fake) => (mergesCleanly(session, fake), 1)],
      ['not-merged', () => 0]
    ]

    it.each(mergerFailures)(
      'stops launching when the merger fails with %s, keeping the ticket worktree and naming the log',
      async (check, behave) => {
        const { ports, claude, git } = portsFor(
          [ticket(1), ticket(2, [{ number: 1, open: true }]), ticket(3)],
          (session, fake) =>
            session.role === 'merger' ? behave(session, fake) : succeeds(session, fake)
        )

        const result = await runSpec(100, {}, ports)

        expect(result.ok).toBe(false)
        expect(claude.sessions.map(({ role }) => role)).toEqual(['implementer', 'merger'])
        const state = readState(100)
        expect(state.tickets[1]).toMatchObject({
          status: 'implemented',
          merger: { outcome: { check } }
        })
        expect(state.tickets[2].status).toBe('pending')
        expect(state.tickets[3].status).toBe('pending')
        expect(git.removed).toEqual([])
        const failed = lines.find((line) => /failed/.test(line))
        expect(failed).toMatch(/#1\b/)
        expect(failed).toContain(check)
        expect(failed).toContain(join(root, '.implement-spec', '100', 'logs', 'merger-1.log'))
      }
    )

    it('keeps merging independent tickets after an implementer fails, but never launches its dependents', async () => {
      const { ports, claude } = portsFor(
        [ticket(1), ticket(2, [{ number: 1, open: true }]), ticket(3)],
        (session, fake) =>
          session.role === 'implementer' && session.cwd.endsWith('-1') ? 1 : succeeds(session, fake)
      )

      const result = await runSpec(100, {}, ports)

      expect(result.ok).toBe(false)
      const state = readState(100)
      expect([1, 2, 3].map((n) => state.tickets[n].status)).toEqual(['failed', 'pending', 'done'])
      expect(claude.sessions.some(({ cwd }) => cwd.endsWith('-2'))).toBe(false)
    })
  })

  describe('--explore', () => {
    it('runs one explorer session in the integration worktree before any implementer, and points implementers at its notes', async () => {
      const { ports, claude } = portsFor([ticket(1)])

      await runSpec(100, { explore: true }, ports)

      const runDir = join(root, '.implement-spec', '100')
      expect(claude.sessions.map(({ role }) => role)).toEqual(['explorer', 'implementer', 'merger'])
      const [explorer, implementer] = claude.sessions
      expect(explorer).toMatchObject({
        cwd: join(root, '.claude', 'worktrees', 'implement-spec-100'),
        resume: false,
        logFile: join(runDir, 'logs', 'explorer.log')
      })
      expect(explorer.prompt).toMatch(/#100\b/)
      expect(explorer.prompt).toContain(join(runDir, 'notes'))
      expect(implementer.prompt).toContain(join(runDir, 'notes'))
    })

    it('runs no explorer without the flag', async () => {
      const { ports, claude } = portsFor([ticket(1)])

      await runSpec(100, {}, ports)

      expect(claude.sessions.map(({ role }) => role)).toEqual(['implementer', 'merger'])
      expect(readState(100).steps?.explore).toBeUndefined()
    })

    it('records the finished exploration so a re-run does not explore again', async () => {
      const { ports, claude } = portsFor([ticket(1), ticket(2, [{ number: 1, open: true }])])

      await runSpec(100, { explore: true }, ports)
      expect(readState(100).steps.explore).toMatchObject({
        status: 'done',
        session: { id: claude.sessions[0].sessionId }
      })
      await runSpec(100, { explore: true }, ports)

      expect(claude.sessions.filter(({ role }) => role === 'explorer')).toHaveLength(1)
    })

    it('launches no implementer when the explorer fails, naming its log', async () => {
      const { ports, claude } = portsFor([ticket(1)], (session, fake) =>
        session.role === 'explorer' ? 1 : implementsCleanly(session, fake)
      )

      const result = await runSpec(100, { explore: true }, ports)

      expect(result.ok).toBe(false)
      expect(claude.sessions.map(({ role }) => role)).toEqual(['explorer'])
      expect(readState(100).steps.explore.status).toBe('failed')
      const failed = lines.find((line) => /failed/.test(line))
      expect(failed).toMatch(/explorer/)
      expect(failed).toContain(join(root, '.implement-spec', '100', 'logs', 'explorer.log'))
    })
  })
})
