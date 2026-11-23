import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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

const prDescription = '## Summary\n\nImplements the spec.\n\nCloses #100\nCloses #1'

type DraftPr = Parameters<TrackerPort['openDraftPr']>[0] & { number: number }

/**
 * A fake tracker serving a fixed graph, counting how often it is read and recording the PRs it
 * opens, every body it sets (read from the file when it is set) and which PRs it marks ready.
 */
const fakeTracker = (tickets: Ticket[]) => {
  const reads: number[] = []
  const prs: DraftPr[] = []
  const bodies: { pr: number; body: string }[] = []
  const ready: number[] = []
  const tracker: TrackerPort = {
    setPrBody: async (pr, bodyFile) => {
      bodies.push({ pr, body: readFileSync(bodyFile, 'utf8') })
    },
    markPrReady: async (pr) => {
      ready.push(pr)
    },
    readSpec: async (spec) => {
      reads.push(spec)
      return tickets
    },
    openDraftPr: async (pr) => {
      const number = 500 + prs.length
      prs.push({ ...pr, number })
      return number
    }
  }
  return { tracker, reads, prs, bodies, ready }
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

/** A PR writer that writes `body` to the PR body file its prompt names, and exits 0. */
const writesPrBody =
  (body: string): Behave =>
  (session) => {
    const file = session.prompt.match(/\S+pr-body\.md/)?.[0]
    if (file === undefined) throw new Error('PR writer prompt names no PR body file')
    writeFileSync(file, body)
    return 0
  }

/**
 * Every role succeeds: implementers and the fixer commit, mergers merge, the PR writer writes a
 * description with every `Closes` line, and the reviewer exits 0.
 */
const succeeds: Behave = (session, git) => {
  if (session.role === 'merger') return mergesCleanly(session, git)
  if (session.role === 'pr-writer') return writesPrBody(prDescription)(session, git)
  if (session.role === 'implementer' || session.role === 'fixer')
    return implementsCleanly(session, git)
  return 0
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
        const { ports, git } = portsFor([ticket(1)], behave)

        const result = await runSpec(100, {}, ports)

        expect(result.ok).toBe(false)
        expect(git.worktrees.get(join(root, '.claude', 'worktrees', 'implement-spec-100-1'))).toBe(
          'implement-spec/100-1'
        )
        expect(git.removed).toEqual([])
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
      expect(claude.sessions.map(({ role, logFile }) => [role, logFile])).toEqual([
        ...[1, 2, 3].flatMap((n) => [
          ['implementer', join(root, '.implement-spec', '100', 'logs', `implementer-${n}.log`)],
          ['merger', join(root, '.implement-spec', '100', 'logs', `merger-${n}.log`)]
        ]),
        ...['reviewer', 'fixer', 'pr-writer'].map((role) => [
          role,
          join(root, '.implement-spec', '100', 'logs', `${role}.log`)
        ])
      ])
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
      // The ticket worktree goes right after its merge; the integration worktree only once the PR is ready.
      expect(git.removed).toEqual([
        join(root, '.claude', 'worktrees', 'implement-spec-100-1'),
        integration.path
      ])
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
      'stops launching and merging when the merger fails with %s, letting running sessions finish, keeping worktrees and naming the log',
      async (check, behave) => {
        const { ports, claude, git } = portsFor(
          [ticket(1), ticket(2, [{ number: 1, open: true }]), ticket(3)],
          async (session, fake) => {
            if (session.role === 'merger') return behave(session, fake)
            if (session.cwd.endsWith('-3')) await new Promise((resolve) => setTimeout(resolve, 10))
            return succeeds(session, fake)
          }
        )

        const result = await runSpec(100, {}, ports)

        expect(result.ok).toBe(false)
        expect(claude.sessions.map(({ role, cwd }) => `${role} ${cwd.slice(-1)}`)).toEqual([
          'implementer 1',
          'implementer 3',
          'merger 0'
        ])
        const state = readState(100)
        expect(state.tickets[1]).toMatchObject({
          status: 'implemented',
          merger: { outcome: { check } }
        })
        expect(state.tickets[2].status).toBe('pending')
        expect(state.tickets[3].status).toBe('implemented')
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

  describe('running ready tickets in parallel', () => {
    /** Wraps `behave` so each session waits `delay(session)` ms first, recording when it starts and ends. */
    const timed = (delay: (session: Session) => number, behave: Behave = succeeds) => {
      const events: string[] = []
      const name = (session: Session) => {
        const ticket = session.logFile.match(/-(\d+)\.log$/)?.[1]
        return ticket === undefined ? session.role : `${session.role}-${ticket}`
      }
      const run: Behave = async (session, fake) => {
        events.push(`start ${name(session)}`)
        await new Promise((resolve) => setTimeout(resolve, delay(session)))
        const exitCode = await behave(session, fake)
        events.push(`end ${name(session)}`)
        return exitCode
      }
      return { events, run }
    }
    const ticketOf = (session: Session) => Number(session.logFile.match(/-(\d+)\.log$/)?.[1])

    it('runs both middle tickets of a diamond at once, and the last only after both merge', async () => {
      const { events, run } = timed((session) =>
        session.role === 'implementer' && ticketOf(session) === 3 ? 20 : 1
      )
      const { ports } = portsFor(
        [
          ticket(4, [
            { number: 2, open: true },
            { number: 3, open: true }
          ]),
          ticket(2, [{ number: 1, open: true }]),
          ticket(3, [{ number: 1, open: true }]),
          ticket(1)
        ],
        run
      )

      const result = await runSpec(100, {}, ports)

      expect(result.ok).toBe(true)
      expect(events).toEqual([
        'start implementer-1',
        'end implementer-1',
        'start merger-1',
        'end merger-1',
        'start implementer-2',
        'start implementer-3',
        'end implementer-2',
        'start merger-2',
        'end merger-2',
        'end implementer-3',
        'start merger-3',
        'end merger-3',
        'start implementer-4',
        'end implementer-4',
        'start merger-4',
        'end merger-4',
        ...['reviewer', 'fixer', 'pr-writer'].flatMap((role) => [`start ${role}`, `end ${role}`])
      ])
      const state = readState(100)
      expect([1, 2, 3, 4].map((n) => state.tickets[n].status)).toEqual([
        'done',
        'done',
        'done',
        'done'
      ])
    })
    it('launches every ready ticket at once and merges them one at a time, in the order their implementers finished', async () => {
      const implementerDelay: Record<number, number> = { 1: 10, 2: 20, 3: 1, 4: 25, 5: 5 }
      const { events, run } = timed((session) =>
        session.role === 'merger' ? 15 : implementerDelay[ticketOf(session)]
      )
      const { ports } = portsFor(
        [1, 2, 3, 4, 5].map((n) => ticket(n)),
        run
      )

      const result = await runSpec(100, {}, ports)

      expect(result.ok).toBe(true)
      expect(events.slice(0, 5)).toEqual([1, 2, 3, 4, 5].map((n) => `start implementer-${n}`))
      const mergers = events.filter((event) => event.includes('merger'))
      expect(mergers).toEqual(
        [3, 5, 1, 2, 4].flatMap((n) => [`start merger-${n}`, `end merger-${n}`])
      )
    })
  })

  describe('--explore', () => {
    it('runs one explorer session in the integration worktree before any implementer, and points implementers at its notes', async () => {
      const { ports, claude } = portsFor([ticket(1)])

      await runSpec(100, { explore: true }, ports)

      const runDir = join(root, '.implement-spec', '100')
      expect(claude.sessions.map(({ role }) => role)).toEqual([
        'explorer',
        'implementer',
        'merger',
        'reviewer',
        'fixer',
        'pr-writer'
      ])
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

      expect(claude.sessions.some(({ role }) => role === 'explorer')).toBe(false)
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

  describe('the draft PR', () => {
    it('opens no PR before the first merge, and a draft PR from the integration branch right after it', async () => {
      const prsAt: Record<string, number> = {}
      const { ports, tracker } = portsFor(
        [ticket(1), ticket(2, [{ number: 1, open: true }])],
        (session, fake) => {
          const ticketLog = session.logFile.match(/(\d+)\.log$/)?.[1]
          if (ticketLog !== undefined) prsAt[`${session.role}-${ticketLog}`] = tracker.prs.length
          return succeeds(session, fake)
        }
      )

      await runSpec(100, {}, ports)

      expect(prsAt).toEqual({
        'implementer-1': 0,
        'merger-1': 0,
        'implementer-2': 1,
        'merger-2': 1
      })
      expect(tracker.prs).toEqual([
        expect.objectContaining({ head: 'implement-spec/100', base: 'main', number: 500 })
      ])
      expect(lines).toContainEqual(expect.stringMatching(/PR #500/))
    })

    it('has a body closing the spec and every ticket', async () => {
      const { ports, tracker } = portsFor([
        ticket(1),
        ticket(2, [{ number: 1, open: true }]),
        ticket(3, [{ number: 91, open: true }])
      ])

      await runSpec(100, {}, ports)

      const [{ body }] = tracker.prs
      expect(body.split('\n')).toEqual(['Closes #100', 'Closes #1', 'Closes #2', 'Closes #3'])
    })

    it('records the PR number in the state file and reuses it on a re-run', async () => {
      const tickets = [ticket(1), ticket(2, [{ number: 90, open: true }])]
      const { ports, tracker } = portsFor(tickets)
      await runSpec(100, {}, ports)
      expect(readState(100).pr).toBe(500)

      tickets[1].blockedBy = [{ number: 90, open: false }]
      await runSpec(100, {}, ports)

      expect(readState(100).tickets[2].status).toBe('done')
      expect(tracker.prs).toHaveLength(1)
      expect(readState(100).pr).toBe(500)
    })

    it('opens no PR when nothing merges', async () => {
      const { ports, tracker } = portsFor([ticket(1)], () => 1)

      await runSpec(100, {}, ports)

      expect(tracker.prs).toEqual([])
      expect(readState(100).pr).toBeUndefined()
    })
  })

  describe('the end of the run', () => {
    const runDir = () => join(root, '.implement-spec', '100')
    const endRoles = ['reviewer', 'fixer', 'pr-writer']

    it('runs the reviewer, fixer and PR writer in that order in the integration worktree once every ticket is done', async () => {
      const { ports, claude } = portsFor([ticket(1), ticket(2, [{ number: 1, open: true }])])

      const result = await runSpec(100, {}, ports)

      expect(result.ok).toBe(true)
      expect(claude.sessions.map(({ role }) => role)).toEqual([
        'implementer',
        'merger',
        'implementer',
        'merger',
        ...endRoles
      ])
      const end = claude.sessions.slice(4)
      for (const session of end) {
        expect(session).toMatchObject({
          cwd: join(root, '.claude', 'worktrees', 'implement-spec-100'),
          resume: false,
          logFile: join(runDir(), 'logs', `${session.role}.log`)
        })
        expect(session.prompt).toMatch(/#100\b/)
        expect(session.prompt).toContain(join(runDir(), 'notes'))
      }
      const [reviewer, fixer, prWriter] = end
      expect(reviewer.prompt).toContain('code-review')
      expect(reviewer.prompt).toContain('main...implement-spec/100')
      expect(fixer.prompt).toMatch(/\btdd\b/)
      expect(prWriter.prompt).toContain(join(runDir(), 'pr-body.md'))
      expect(new Set(claude.sessions.map(({ sessionId }) => sessionId)).size).toBe(7)
    })

    it('appends the Closes lines the description is missing, replaces the PR body, marks the PR ready and removes the integration worktree', async () => {
      const order: string[] = []
      const { ports, tracker, git } = portsFor(
        [ticket(1), ticket(2, [{ number: 1, open: true }]), ticket(3)],
        succeeds
      )
      const { setPrBody, markPrReady } = ports.tracker
      ports.tracker.setPrBody = async (pr, file) => (order.push('body'), setPrBody(pr, file))
      ports.tracker.markPrReady = async (pr) => (order.push('ready'), markPrReady(pr))
      const { removeWorktree } = ports.git
      ports.git.removeWorktree = async (path) => (
        order.push(`remove ${path}`),
        removeWorktree(path)
      )

      const result = await runSpec(100, {}, ports)

      expect(result.ok).toBe(true)
      const integration = join(root, '.claude', 'worktrees', 'implement-spec-100')
      expect(order.slice(-3)).toEqual(['body', 'ready', `remove ${integration}`])
      expect(tracker.bodies).toEqual([{ pr: 500, body: expect.any(String) }])
      const [{ body }] = tracker.bodies
      expect(body.startsWith(prDescription)).toBe(true)
      const closes = body.split('\n').filter((line) => line.startsWith('Closes'))
      expect(closes.sort()).toEqual(['Closes #1', 'Closes #100', 'Closes #2', 'Closes #3'])
      expect(tracker.ready).toEqual([500])
      expect(git.worktrees.has(integration)).toBe(false)
      expect(lines).toContainEqual(expect.stringMatching(/PR #500 ready/))
    })

    it('keeps a description that already closes everything as written', async () => {
      const { ports, tracker } = portsFor([ticket(1)])

      await runSpec(100, {}, ports)

      expect(tracker.bodies.map(({ body }) => body.trimEnd())).toEqual([prDescription])
    })

    it('records every finished end-of-run step in the state file', async () => {
      const { ports, claude } = portsFor([ticket(1)])

      await runSpec(100, {}, ports)

      const id = (role: string) =>
        claude.sessions.find((session) => session.role === role)?.sessionId
      expect(readState(100).steps).toEqual({
        review: {
          status: 'done',
          session: { id: id('reviewer'), outcome: { exitCode: 0, check: 'passed' } }
        },
        fix: {
          status: 'done',
          session: { id: id('fixer'), outcome: { exitCode: 0, check: 'passed' } }
        },
        'pr-description': {
          status: 'done',
          session: { id: id('pr-writer'), outcome: { exitCode: 0, check: 'passed' } }
        },
        ready: { status: 'done' }
      })
    })

    it('runs no end-of-run step while a ticket is not done, and leaves the PR a draft', async () => {
      const { ports, claude, tracker } = portsFor([
        ticket(1),
        ticket(2, [{ number: 90, open: true }])
      ])

      await runSpec(100, {}, ports)

      expect(claude.sessions.map(({ role }) => role)).toEqual(['implementer', 'merger'])
      expect(tracker.bodies).toEqual([])
      expect(tracker.ready).toEqual([])
      expect(readState(100).steps).toBeUndefined()
    })

    it('stops before the next step when an end-of-run session fails, naming its log', async () => {
      const { ports, claude, tracker } = portsFor([ticket(1)], (session, fake) =>
        session.role === 'fixer' ? 1 : succeeds(session, fake)
      )

      const result = await runSpec(100, {}, ports)

      expect(result.ok).toBe(false)
      expect(claude.sessions.map(({ role }) => role).slice(-2)).toEqual(['reviewer', 'fixer'])
      expect(tracker.ready).toEqual([])
      expect(readState(100).steps.fix.status).toBe('failed')
      expect(lines.find((line) => /failed/.test(line))).toContain(
        join(runDir(), 'logs', 'fixer.log')
      )
    })

    it('fails the PR description step when the PR writer leaves no body file', async () => {
      const { ports, tracker } = portsFor([ticket(1)], (session, fake) =>
        session.role === 'pr-writer' ? 0 : succeeds(session, fake)
      )

      const result = await runSpec(100, {}, ports)

      expect(result.ok).toBe(false)
      expect(existsSync(join(runDir(), 'pr-body.md'))).toBe(false)
      expect(readState(100).steps['pr-description']).toMatchObject({
        status: 'failed',
        session: { outcome: { exitCode: 0, check: 'no-pr-body' } }
      })
      expect(tracker.bodies).toEqual([])
      expect(tracker.ready).toEqual([])
    })
  })

  describe('resuming on a re-run', () => {
    const interrupted = new Error('run interrupted')

    it('resumes an implementer left running with its saved session ID in its worktree, telling it why', async () => {
      let crash = true
      const { ports, claude } = portsFor(
        [ticket(1), ticket(2, [{ number: 1, open: true }])],
        (session, fake) => {
          if (crash && session.role === 'implementer') {
            crash = false
            throw interrupted
          }
          return succeeds(session, fake)
        }
      )
      await expect(runSpec(100, {}, ports)).rejects.toBe(interrupted)
      expect(readState(100).tickets[1].status).toBe('running')

      const result = await runSpec(100, {}, ports)

      expect(result.ok).toBe(true)
      const [first, resumed] = claude.sessions
      expect(resumed).toMatchObject({
        role: 'implementer',
        cwd: first.cwd,
        sessionId: first.sessionId,
        resume: true,
        logFile: first.logFile
      })
      expect(resumed.prompt).toMatch(/didn't complete/)
      expect(resumed.prompt).toMatch(/interrupted/)
      expect(resumed.prompt).toContain(first.prompt)
      expect(readState(100).tickets[1]).toMatchObject({
        status: 'done',
        session: { id: first.sessionId, outcome: { exitCode: 0, check: 'passed' } }
      })
      expect(lines).toContainEqual(expect.stringMatching(/resumed #1 implementer/))
    })

    it('resumes a failed implementer naming the failed check, holds it to the done check, then launches its dependents once it merges', async () => {
      let attempts = 0
      const { ports, claude } = portsFor(
        [ticket(1), ticket(2, [{ number: 1, open: true }])],
        (session, fake) => {
          if (session.role === 'implementer' && session.cwd.endsWith('-1') && ++attempts < 3) {
            return 0
          }
          return succeeds(session, fake)
        }
      )
      expect((await runSpec(100, {}, ports)).ok).toBe(false)
      expect(readState(100).tickets[1].status).toBe('failed')

      // The resumed session again makes no commits: the done check still fails it.
      expect((await runSpec(100, {}, ports)).ok).toBe(false)
      expect(readState(100).tickets[1]).toMatchObject({
        status: 'failed',
        session: { outcome: { check: 'no-commits' } }
      })
      lines.length = 0
      const result = await runSpec(100, {}, ports)

      expect(result.ok).toBe(true)
      const [first, ...rest] = claude.sessions
      expect(rest.slice(0, 2)).toEqual([
        expect.objectContaining({ sessionId: first.sessionId, cwd: first.cwd, resume: true }),
        expect.objectContaining({ sessionId: first.sessionId, cwd: first.cwd, resume: true })
      ])
      expect(rest[0].prompt).toContain('no-commits')
      expect(rest[0].prompt).toContain(first.prompt)
      expect(
        claude.sessions.map(({ role, logFile }) => `${role} ${logFile.slice(-6, -4)}`)
      ).toEqual([
        'implementer -1',
        'implementer -1',
        'implementer -1',
        'merger -1',
        'implementer -2',
        'merger -2',
        'reviewer er',
        'fixer er',
        'pr-writer er'
      ])
      expect(lines).not.toContain('failed tickets:')
    })

    it('resumes a failed merger before launching anything, then merges tickets left implemented', async () => {
      let mergerFails = true
      const events: string[] = []
      const tickets = [
        ticket(1),
        ticket(2, [{ number: 1, open: true }]),
        ticket(3),
        ticket(4, [{ number: 90, open: true }])
      ]
      const { ports, claude } = portsFor(tickets, async (session, fake) => {
        const name = `${session.role}-${session.logFile.match(/-(\d+)\.log$/)?.[1]}`
        events.push(`start ${name}`)
        if (session.role === 'implementer' && session.cwd.endsWith('-3')) {
          await new Promise((resolve) => setTimeout(resolve, 10))
        }
        const exitCode =
          session.role === 'merger' && mergerFails ? 1 : await succeeds(session, fake)
        events.push(`end ${name}`)
        return exitCode
      })
      await runSpec(100, {}, ports)
      expect(readState(100).tickets[3].status).toBe('implemented')
      const failedMerger = claude.sessions.find(({ role }) => role === 'merger')
      mergerFails = false
      tickets[3].blockedBy = [{ number: 90, open: false }]
      events.length = 0
      lines.length = 0

      const result = await runSpec(100, {}, ports)

      expect(result.ok).toBe(true)
      expect(events.slice(0, 2)).toEqual(['start merger-1', 'end merger-1'])
      const resumed = claude.sessions.filter(({ role }) => role === 'merger')[1]
      expect(resumed).toMatchObject({
        sessionId: failedMerger?.sessionId,
        cwd: failedMerger?.cwd,
        resume: true
      })
      expect(resumed?.prompt).toMatch(/exited with code 1/)
      expect(resumed?.prompt).toContain(failedMerger?.prompt)
      expect(events.filter((event) => event.startsWith('start merger'))).toEqual([
        'start merger-1',
        'start merger-3',
        'start merger-2',
        'start merger-4'
      ])
      const state = readState(100)
      expect([1, 2, 3, 4].map((n) => state.tickets[n].status)).toEqual([
        'done',
        'done',
        'done',
        'done'
      ])
      expect(
        claude.sessions.filter(({ logFile }) => logFile.endsWith('implementer-3.log'))
      ).toHaveLength(1)
      expect(lines).toContainEqual(expect.stringMatching(/resumed #1 merger/))
    })

    it('resumes a failed end-of-run session in the integration worktree and finishes the run', async () => {
      let fixerFails = true
      const { ports, claude, tracker } = portsFor([ticket(1)], (session, fake) =>
        session.role === 'fixer' && fixerFails ? 1 : succeeds(session, fake)
      )
      await runSpec(100, {}, ports)
      const failedFixer = claude.sessions.find(({ role }) => role === 'fixer')
      fixerFails = false

      const result = await runSpec(100, {}, ports)

      expect(result.ok).toBe(true)
      const rerun = claude.sessions.slice(claude.sessions.indexOf(failedFixer as Session) + 1)
      expect(rerun.map(({ role }) => role)).toEqual(['fixer', 'pr-writer'])
      expect(rerun[0]).toMatchObject({
        sessionId: failedFixer?.sessionId,
        cwd: failedFixer?.cwd,
        resume: true
      })
      expect(rerun[0].prompt).toContain(failedFixer?.prompt)
      expect(rerun[1].resume).toBe(false)
      expect(tracker.ready).toEqual([500])
      expect(readState(100).steps.fix).toMatchObject({
        status: 'done',
        session: { id: failedFixer?.sessionId, outcome: { check: 'passed' } }
      })
    })

    it('resumes an explorer left running before any implementer launches', async () => {
      let crash = true
      const { ports, claude } = portsFor([ticket(1)], (session, fake) => {
        if (crash && session.role === 'explorer') {
          crash = false
          throw interrupted
        }
        return succeeds(session, fake)
      })
      await expect(runSpec(100, { explore: true }, ports)).rejects.toBe(interrupted)

      await runSpec(100, { explore: true }, ports)

      const [first, resumed, next] = claude.sessions
      expect(resumed).toMatchObject({
        role: 'explorer',
        sessionId: first.sessionId,
        cwd: first.cwd,
        resume: true
      })
      expect(resumed.prompt).toMatch(/interrupted/)
      expect(next.role).toBe('implementer')
    })

    it('does no work on a re-run of a finished run', async () => {
      const { ports, claude, git, tracker } = portsFor([ticket(1)])
      await runSpec(100, {}, ports)
      const stateAfterFirst = readState(100)
      const counts = () => [
        claude.sessions.length,
        git.added.length,
        git.removed.length,
        tracker.reads.length,
        tracker.prs.length,
        tracker.bodies.length,
        tracker.ready.length
      ]
      const before = counts()
      lines.length = 0

      const result = await runSpec(100, { explore: true }, ports)

      expect(result.ok).toBe(true)
      expect(counts()).toEqual(before)
      expect(readState(100)).toEqual(stateAfterFirst)
      expect(lines).toEqual([expect.stringMatching(/already finished.*PR #500/)])
    })

    it('starts every fresh session with a distinct session ID already in the state file', async () => {
      const savedAtLaunch: boolean[] = []
      const { ports, claude } = portsFor(
        [ticket(1), ticket(2, [{ number: 1, open: true }]), ticket(3)],
        (session, fake) => {
          savedAtLaunch.push(JSON.stringify(readState(100)).includes(`"${session.sessionId}"`))
          return succeeds(session, fake)
        }
      )

      await runSpec(100, { explore: true }, ports)

      expect(claude.sessions).toHaveLength(10)
      expect(claude.sessions.every(({ resume }) => !resume)).toBe(true)
      expect(new Set(claude.sessions.map(({ sessionId }) => sessionId)).size).toBe(10)
      expect(savedAtLaunch).toEqual(Array(10).fill(true))
    })

    it('names the exit code when resuming an implementer that exited non-zero', async () => {
      let attempts = 0
      const { ports, claude } = portsFor([ticket(1)], (session, fake) =>
        session.role === 'implementer' && ++attempts === 1 ? 3 : succeeds(session, fake)
      )
      await runSpec(100, {}, ports)

      await runSpec(100, {}, ports)

      expect(claude.sessions[1].prompt).toMatch(/exited with code 3/)
    })
  })

  describe('containing failures', () => {
    const logs = join('.implement-spec', '100', 'logs')

    it('costs only the failed ticket and its transitive dependents, skipping the end of the run and leaving the PR a draft', async () => {
      const { ports, claude, tracker } = portsFor(
        [
          ticket(1),
          ticket(2, [{ number: 1, open: true }]),
          ticket(3, [{ number: 2, open: true }]),
          ticket(4)
        ],
        (session, fake) =>
          session.role === 'implementer' && session.cwd.endsWith('-1') ? 1 : succeeds(session, fake)
      )

      const result = await runSpec(100, {}, ports)

      expect(result.ok).toBe(false)
      const state = readState(100)
      expect([1, 2, 3, 4].map((n) => state.tickets[n].status)).toEqual([
        'failed',
        'pending',
        'pending',
        'done'
      ])
      // No retries: each launched ticket ran exactly one implementer.
      expect(claude.sessions.map(({ role, cwd }) => `${role} ${cwd.slice(-1)}`)).toEqual([
        'implementer 1',
        'implementer 4',
        'merger 0'
      ])
      expect(state.steps).toBeUndefined()
      expect(tracker.prs).toHaveLength(1)
      expect(tracker.prs[0].body.split('\n')).toEqual([
        'Closes #100',
        'Closes #1',
        'Closes #2',
        'Closes #3',
        'Closes #4'
      ])
      expect(tracker.bodies).toEqual([])
      expect(tracker.ready).toEqual([])
    })

    it('ends by printing each failed ticket with its check and log', async () => {
      const { ports } = portsFor([ticket(1), ticket(2), ticket(3)], (session, fake) => {
        if (session.role === 'implementer' && session.cwd.endsWith('-2')) return 0
        if (session.role === 'merger') return 1
        return succeeds(session, fake)
      })

      await runSpec(100, {}, ports)

      const summary = lines.slice(lines.indexOf('failed tickets:'))
      expect(summary).toEqual([
        'failed tickets:',
        expect.stringMatching(/^ {2}#1 merger nonzero-exit \(log .*\)$/),
        expect.stringMatching(/^ {2}#2 implementer no-commits \(log .*\)$/)
      ])
      expect(summary[1]).toContain(join(root, logs, 'merger-1.log'))
      expect(summary[2]).toContain(join(root, logs, 'implementer-2.log'))
    })

    it('prints no failure summary when nothing failed', async () => {
      const { ports } = portsFor([ticket(1)])

      await runSpec(100, {}, ports)

      expect(lines).not.toContain('failed tickets:')
    })
  })
})
