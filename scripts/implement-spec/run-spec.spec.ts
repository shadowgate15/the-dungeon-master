import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  runSpec,
  USAGE_LIMIT_GRACE_MS,
  type ClaudeExit,
  type ChecksPort,
  type ChecksResult,
  type ClaudePort,
  type GitPort,
  type MergeResult,
  type Ports,
  type RunState,
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
      if (ready.includes(pr)) throw new Error(`PR #${pr} is already ready`)
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

/** What a fake `git merge` does with a branch: merge it cleanly, or report a conflict or error. */
type MergeScript = (branch: string) => MergeResult

/**
 * The fake git's default merge: every merge conflicts, so a merger session resolves it, as the
 * tests written before git merges came first expect.
 */
const conflicts: MergeScript = () => ({ result: 'conflicts', paths: ['conflicted.ts'] })

/**
 * A fake git holding branches, worktrees and a commit graph in memory, with `main` already present.
 * Each commit records its parents, so ancestry answers come from the graph the way real git's do.
 * `merge` answers from `mergeScript` (a clean merge commits on the branch checked out in the
 * worktree), and every merge attempt and abort is recorded.
 */
const fakeGit = (root: string, mergeScript: MergeScript = conflicts) => {
  const parents = new Map<string, string[]>([['main-tip', []]])
  const branches = new Map<string, string>([['main', 'main-tip']])
  const worktrees = new Map<string, string>()
  const added: { path: string; branch: string; base?: string }[] = []
  const removed: string[] = []
  /** Every push, with the commit the branch pointed at when it was pushed. */
  const pushed: { branch: string; commit: string }[] = []
  /** Every branch `merge` was asked to merge, in order. */
  const merges: string[] = []
  /** The worktree of every `abortMerge` call, in order. */
  const aborts: string[] = []
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
    },
    push: async (branch) => {
      pushed.push({ branch, commit: tip(branch) })
    },
    merge: async (worktree, branch) => {
      const into = worktrees.get(worktree)
      if (into === undefined) throw new Error(`no worktree at ${worktree}`)
      merges.push(branch)
      const result = mergeScript(branch)
      if (result.result === 'clean') commit(into, branch)
      return result
    },
    abortMerge: async (worktree) => {
      aborts.push(worktree)
    }
  }
  return { git, branches, worktrees, added, removed, pushed, merges, aborts, commit }
}

type FakeGit = ReturnType<typeof fakeGit>
type Session = Parameters<ClaudePort['run']>[0]
/** How a fake session behaves: it may act on the fake git as a real one would, and returns its exit code. */
type Behave = (session: Session, git: FakeGit) => ClaudeExit | Promise<ClaudeExit>

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

const ticket = (number: number, blockedBy: Ticket['blockedBy'] = []): Ticket => ({
  number,
  title: `Ticket ${number}`,
  blockedBy
})

let root: string
let lines: string[]
/** The fake clock behind the `now` port; sessions move it forward to take time. */
let clock: { at: number }

const START = Date.parse('2026-11-23T14:00:00Z')
const MINUTE = 60 * 1000

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'implement-spec-'))
  lines = []
  clock = { at: START }
})

afterEach(() => rmSync(root, { recursive: true, force: true }))

/** A fake checks port answering each run with `answer` (passing by default), recording each call. */
const fakeChecks = (
  answer: (run: Parameters<ChecksPort['run']>[0]) => ChecksResult | Promise<ChecksResult>
) => {
  const runs: Parameters<ChecksPort['run']>[0][] = []
  const checks: ChecksPort = {
    run: async (run) => {
      runs.push(run)
      return answer(run)
    }
  }
  return { checks, runs }
}

type Scripts = {
  merge?: MergeScript
  checks?: (run: Parameters<ChecksPort['run']>[0]) => ChecksResult | Promise<ChecksResult>
}

const portsFor = (tickets: Ticket[], behave: Behave = succeeds, scripts: Scripts = {}) => {
  const tracker = fakeTracker(tickets)
  const git = fakeGit(root, scripts.merge)
  const claude = fakeClaude(git, behave)
  const checks = fakeChecks(scripts.checks ?? (() => ({ passed: true })))
  const waits: number[] = []
  /** Every state the run handed the progress port, copied as it was then. */
  const shown: RunState[] = []
  const ports: Ports = {
    now: () => clock.at,
    pid: 4242,
    progress: (state) => shown.push(structuredClone(state)),
    tracker: tracker.tracker,
    git: git.git,
    claude: claude.claude,
    checks: checks.checks,
    log: (line) => lines.push(line),
    waitUntil: async (time) => {
      waits.push(time)
    }
  }
  return { ports, tracker, git, claude, checks, waits, shown }
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
    const ready = lines.filter((line) => line.startsWith('ready ')).join('\n')
    expect(ready).toMatch(/#1\b/)
    expect(ready).toMatch(/#2\b/)
    expect(ready).not.toMatch(/#3\b|#4\b/)
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

    const stateAfterSecond = readState(100)
    expect(stateAfterSecond.runs).toHaveLength(2)
    expect(integrationWorktrees(git)).toHaveLength(1)
    expect({ ...stateAfterSecond, runs: [] }).toEqual({ ...stateAfterFirst, runs: [] })
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
      expect(stateAtLaunch?.tickets[1].session).toEqual({
        id: sessionId,
        startedAt: START,
        attempts: 1
      })
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
        expect.stringMatching(/git merge.*conflicted.*handing it to a merger/),
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
      expect(stateAtMerge?.tickets[1].merger).toEqual({
        id: merger?.sessionId,
        startedAt: START,
        attempts: 1
      })
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

  describe('merging with git first', () => {
    const clean: MergeScript = () => ({ result: 'clean' })
    const logs = () => join(root, '.implement-spec', '100', 'logs')
    const ticketWorktree = (n: number) =>
      join(root, '.claude', 'worktrees', `implement-spec-100-${n}`)

    it('marks a ticket done with no merger when git merges it cleanly and the checks pass, then removes its worktree and publishes', async () => {
      const { ports, claude, git, checks, tracker } = portsFor([ticket(1)], succeeds, {
        merge: clean
      })

      const result = await runSpec(100, {}, ports)

      expect(result.ok).toBe(true)
      expect(claude.sessions.map(({ role }) => role)).toEqual([
        'implementer',
        'reviewer',
        'fixer',
        'pr-writer'
      ])
      expect(git.merges).toEqual(['implement-spec/100-1'])
      const [integration] = integrationWorktrees(git)
      expect(checks.runs).toEqual([
        { cwd: integration.path, logFile: join(logs(), 'checks-1.log') }
      ])
      const state = readState(100)
      expect(state.tickets[1].status).toBe('done')
      expect(state.tickets[1].merger).toBeUndefined()
      expect(git.removed[0]).toBe(ticketWorktree(1))
      expect(
        await git.git.contains('implement-spec/100', git.branches.get('implement-spec/100-1') ?? '')
      ).toBe(true)
      expect(git.pushed[0].branch).toBe('implement-spec/100')
      expect(tracker.prs).toHaveLength(1)
      expect(lines).toContain('merged #1 by git, checks passed')
    })

    it('saves the git merge in the run state before the checks run, then records their timing and outcome', async () => {
      let atChecks: ReturnType<typeof readState> | undefined
      const { ports } = portsFor([ticket(1)], succeeds, {
        merge: clean,
        checks: () => {
          atChecks = readState(100)
          clock.at += 3 * MINUTE
          return { passed: true }
        }
      })

      await runSpec(100, {}, ports)

      expect(atChecks?.tickets[1]).toMatchObject({
        status: 'implemented',
        gitMerge: { startedAt: START }
      })
      expect(atChecks?.tickets[1].gitMerge.endedAt).toBeUndefined()
      expect(readState(100).tickets[1].gitMerge).toEqual({
        startedAt: START,
        endedAt: START + 3 * MINUTE,
        checks: { passed: true }
      })
    })

    it('fails the merge when the checks fail, leaving the ticket implemented with its worktree and stopping new merges', async () => {
      const { ports, claude, git, tracker } = portsFor(
        [ticket(1), ticket(2, [{ number: 1, open: true }])],
        succeeds,
        { merge: clean, checks: () => ({ passed: false, step: 'lint' }) }
      )

      const result = await runSpec(100, {}, ports)

      expect(result.ok).toBe(false)
      expect(claude.sessions.map(({ role }) => role)).toEqual(['implementer'])
      const state = readState(100)
      expect(state.tickets[1]).toMatchObject({
        status: 'implemented',
        gitMerge: { checks: { passed: false, step: 'lint' } }
      })
      expect(state.tickets[1].merger).toBeUndefined()
      expect(state.tickets[2].status).toBe('pending')
      expect(git.removed).toEqual([])
      expect(git.pushed).toEqual([])
      expect(tracker.prs).toEqual([])
      const failed = lines.filter((line) => /failed/.test(line) && /#1\b/.test(line))
      expect(failed.join('\n')).toContain('lint')
      expect(failed.join('\n')).toContain(join(logs(), 'checks-1.log'))
      expect(lines.slice(lines.indexOf('failed tickets:') + 1)).toEqual([
        `  #1 checks lint (log ${join(logs(), 'checks-1.log')})`
      ])
    })

    it('aborts a conflicted merge and launches a merger whose prompt lists the conflicting files', async () => {
      const { ports, claude, git, checks } = portsFor([ticket(1)], succeeds, {
        merge: () => ({ result: 'conflicts', paths: ['src/a.ts', 'src/b.ts'] })
      })

      const result = await runSpec(100, {}, ports)

      expect(result.ok).toBe(true)
      expect(git.merges).toEqual(['implement-spec/100-1'])
      expect(git.aborts).toEqual([integrationWorktrees(git)[0].path])
      const merger = claude.sessions.find(({ role }) => role === 'merger')
      expect(merger?.model).toBe('opus')
      expect(merger?.prompt).toContain('src/a.ts')
      expect(merger?.prompt).toContain('src/b.ts')
      expect(merger?.prompt).toMatch(/conflict/i)
      expect(checks.runs).toEqual([])
      const state = readState(100)
      expect(state.tickets[1]).toMatchObject({
        status: 'done',
        merger: { outcome: { check: 'passed' } }
      })
      expect(state.tickets[1].gitMerge).toBeUndefined()
      expect(lines.join('\n')).toMatch(/#1.*conflict/)
    })

    it("aborts after any other git error and launches a merger whose prompt includes git's error", async () => {
      const { ports, claude, git, checks } = portsFor([ticket(1)], succeeds, {
        merge: () => ({
          result: 'error',
          message: 'fatal: your local changes would be overwritten'
        })
      })

      const result = await runSpec(100, {}, ports)

      expect(result.ok).toBe(true)
      expect(git.aborts).toHaveLength(1)
      const merger = claude.sessions.find(({ role }) => role === 'merger')
      expect(merger?.prompt).toContain('fatal: your local changes would be overwritten')
      expect(checks.runs).toEqual([])
      expect(readState(100).tickets[1].status).toBe('done')
    })

    it.each(['failed', 'interrupted'])(
      'resumes a %s merger on a re-run with no git merge attempt',
      async (how) => {
        let mergerFails = true
        const { ports, claude, git } = portsFor(
          [ticket(1)],
          (session, fake) =>
            session.role === 'merger' && mergerFails ? 1 : succeeds(session, fake),
          { merge: () => ({ result: 'conflicts', paths: ['src/a.ts'] }) }
        )
        await runSpec(100, {}, ports)
        if (how === 'interrupted') {
          const path = join(root, '.implement-spec', '100', 'state.json')
          const state = readState(100)
          delete state.tickets[1].merger.outcome
          writeFileSync(path, JSON.stringify(state))
        }
        mergerFails = false

        const result = await runSpec(100, {}, ports)

        expect(result.ok).toBe(true)
        expect(git.merges).toEqual(['implement-spec/100-1'])
        expect(git.aborts).toHaveLength(1)
        const mergers = claude.sessions.filter(({ role }) => role === 'merger')
        expect(mergers).toHaveLength(2)
        expect(mergers[1]).toMatchObject({ resume: true, sessionId: mergers[0].sessionId })
        expect(readState(100).tickets[1].status).toBe('done')
      }
    )

    it('merges and checks one ticket at a time, in the order their implementers finished', async () => {
      const events: string[] = []
      const { ports, git } = portsFor(
        [ticket(1), ticket(2)],
        async (session, fake) => {
          if (session.role === 'implementer' && session.cwd.endsWith('-1')) {
            await new Promise((resolve) => setTimeout(resolve, 10))
          }
          return succeeds(session, fake)
        },
        {
          merge: (branch) => {
            events.push(`merge ${branch.slice(-1)}`)
            return { result: 'clean' }
          },
          checks: async ({ logFile }) => {
            const n = logFile.match(/checks-(\d+)\.log$/)?.[1]
            events.push(`checks ${n}`)
            // Ticket 1's implementer finishes while ticket 2's checks are still running.
            await new Promise((resolve) => setTimeout(resolve, 30))
            events.push(`checked ${n}`)
            return { passed: true }
          }
        }
      )

      await runSpec(100, {}, ports)

      expect(events).toEqual([
        'merge 2',
        'checks 2',
        'checked 2',
        'merge 1',
        'checks 1',
        'checked 1'
      ])
      expect(git.merges).toEqual(['implement-spec/100-2', 'implement-spec/100-1'])
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

    it('pushes the integration branch before opening the PR', async () => {
      const order: string[] = []
      const { ports } = portsFor([ticket(1)])
      const { push } = ports.git
      ports.git.push = async (branch) => (order.push(`push ${branch}`), push(branch))
      const { openDraftPr } = ports.tracker
      ports.tracker.openDraftPr = async (pr) => (order.push(`open ${pr.head}`), openDraftPr(pr))

      await runSpec(100, {}, ports)

      expect(order.slice(0, 2)).toEqual(['push implement-spec/100', 'open implement-spec/100'])
    })

    it('pushes the integration branch after every merge, so the PR shows each one', async () => {
      const tips: string[] = []
      const { ports, git } = portsFor(
        [ticket(1), ticket(2, [{ number: 1, open: true }])],
        (session, fake) => {
          const exit = succeeds(session, fake)
          if (session.role === 'merger')
            tips.push(fake.branches.get('implement-spec/100') as string)
          return exit
        }
      )

      await runSpec(100, {}, ports)

      const merges = git.pushed.slice(0, 2)
      expect(merges).toEqual(tips.map((commit) => ({ branch: 'implement-spec/100', commit })))
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

    it('runs every role session on its model: sonnet for exploring, implementing and the PR, opus for merging, review and fixing', async () => {
      const { ports, claude } = portsFor([ticket(1)])

      await runSpec(100, { explore: true }, ports)

      expect(claude.sessions.map(({ role, model }) => [role, model])).toEqual([
        ['explorer', 'sonnet'],
        ['implementer', 'sonnet'],
        ['merger', 'opus'],
        ['reviewer', 'opus'],
        ['fixer', 'opus'],
        ['pr-writer', 'sonnet']
      ])
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
      const { removeWorktree, push } = ports.git
      ports.git.removeWorktree = async (path) => (
        order.push(`remove ${path}`),
        removeWorktree(path)
      )
      ports.git.push = async (branch) => (order.push(`push ${branch}`), push(branch))

      const result = await runSpec(100, {}, ports)

      expect(result.ok).toBe(true)
      const integration = join(root, '.claude', 'worktrees', 'implement-spec-100')
      expect(order.slice(-4)).toEqual([
        'push implement-spec/100',
        'body',
        'ready',
        `remove ${integration}`
      ])
      expect(git.pushed.at(-1)).toEqual({
        branch: 'implement-spec/100',
        commit: git.branches.get('implement-spec/100')
      })
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
      const timed = { startedAt: START, endedAt: START, attempts: 1 }
      expect(readState(100).steps).toEqual({
        review: {
          status: 'done',
          session: { id: id('reviewer'), ...timed, outcome: { exitCode: 0, check: 'passed' } }
        },
        fix: {
          status: 'done',
          session: { id: id('fixer'), ...timed, outcome: { exitCode: 0, check: 'passed' } }
        },
        'pr-description': {
          status: 'done',
          session: { id: id('pr-writer'), ...timed, outcome: { exitCode: 0, check: 'passed' } }
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

  describe('timing', () => {
    it('records when each session started and ended, and that it ran once', async () => {
      const { ports } = portsFor([ticket(1)], (session, fake) => {
        clock.at += session.role === 'implementer' ? 12 * MINUTE : 2 * MINUTE
        return succeeds(session, fake)
      })

      await runSpec(100, {}, ports)

      expect(readState(100).tickets[1]).toMatchObject({
        session: { startedAt: START, endedAt: START + 12 * MINUTE, attempts: 1 },
        merger: { startedAt: START + 12 * MINUTE, endedAt: START + 14 * MINUTE, attempts: 1 }
      })
    })

    it('saves the usage-limit wait while it lasts, then counts the resume as a second attempt', async () => {
      const resetsAt = START + 60 * MINUTE
      let limited = true
      const { ports } = portsFor([ticket(1)], (session, fake) => {
        clock.at += 5 * MINUTE
        if (session.role === 'implementer' && limited) {
          limited = false
          return { usageLimitResetsAt: resetsAt }
        }
        return succeeds(session, fake)
      })
      let waiting: unknown
      ports.waitUntil = async (time) => {
        waiting = readState(100).tickets[1].session
        clock.at = time
      }

      await runSpec(100, {}, ports)

      const until = resetsAt + USAGE_LIMIT_GRACE_MS
      expect(waiting).toMatchObject({ waitingUntil: until, endedAt: START + 5 * MINUTE })
      const session = readState(100).tickets[1].session
      expect(session).toMatchObject({
        attempts: 2,
        activeMs: 5 * MINUTE,
        startedAt: until,
        endedAt: until + 5 * MINUTE
      })
      expect(session.waitingUntil).toBeUndefined()
    })

    it("counts a resume on a re-run as another attempt, keeping the earlier attempt's time", async () => {
      let fails = true
      const { ports } = portsFor([ticket(1)], (session, fake) => {
        clock.at += 3 * MINUTE
        if (session.role === 'implementer' && fails) return 0
        return succeeds(session, fake)
      })
      await runSpec(100, {}, ports)
      fails = false

      await runSpec(100, {}, ports)

      expect(readState(100).tickets[1].session).toMatchObject({ attempts: 2, activeMs: 3 * MINUTE })
    })
    it("closes a session a stopped run left open at the run's last save, keeping its time", async () => {
      const { ports } = portsFor([ticket(1)], (session, fake) => {
        clock.at += 3 * MINUTE
        return session.role === 'implementer' && session.resume !== true
          ? 0
          : succeeds(session, fake)
      })
      await runSpec(100, {}, ports)
      // As if the run had been killed mid-attempt, waiting out a usage limit, at its last save.
      const path = join(root, '.implement-spec', '100', 'state.json')
      const stopped = readState(100)
      const { session } = stopped.tickets[1]
      session.startedAt = START
      delete session.endedAt
      delete session.outcome
      session.waitingUntil = START + 60 * MINUTE
      stopped.tickets[1].status = 'running'
      stopped.runs = [{ startedAt: START, endedAt: START + 4 * MINUTE, pid: 4242 }]
      writeFileSync(path, JSON.stringify(stopped))

      await runSpec(100, {}, ports)

      expect(readState(100).tickets[1].session).toMatchObject({ attempts: 2, activeMs: 4 * MINUTE })
      expect(readState(100).tickets[1].session.waitingUntil).toBeUndefined()
    })
  })

  describe('the run record', () => {
    const runLog = () =>
      readFileSync(join(root, '.implement-spec', '100', 'run.log'), 'utf8')
        .trimEnd()
        .split('\n')

    it("caches each ticket's title and blockers in the state file", async () => {
      const { ports } = portsFor([ticket(1), ticket(2, [{ number: 1, open: true }])])

      await runSpec(100, {}, ports)

      expect(readState(100).graph).toEqual([
        { number: 1, title: 'Ticket 1', blockedBy: [] },
        { number: 2, title: 'Ticket 2', blockedBy: [{ number: 1, open: true }] }
      ])
    })

    it('records when each run started and when it last did anything', async () => {
      const stuck = ticket(2, [{ number: 90, open: true }])
      const { ports } = portsFor([ticket(1), stuck], (session, fake) => {
        clock.at += 10 * MINUTE
        return succeeds(session, fake)
      })
      await runSpec(100, {}, ports)
      clock.at = START + 120 * MINUTE

      await runSpec(100, {}, ports)

      expect(readState(100).runs).toEqual([
        { startedAt: START, endedAt: START + 20 * MINUTE, pid: 4242 },
        { startedAt: START + 120 * MINUTE, endedAt: START + 120 * MINUTE, pid: 4242 }
      ])
    })

    it('appends every console line to run.log with its time, under a header per run', async () => {
      const { ports } = portsFor([ticket(1)], (session, fake) => {
        clock.at += MINUTE
        return session.role === 'merger' && clock.at < START + 3 * MINUTE
          ? 1
          : succeeds(session, fake)
      })
      await runSpec(100, {}, ports)
      await runSpec(100, {}, ports)

      const log = runLog()
      expect(log[0]).toBe('2026-11-23T14:00:00.000Z --- run started')
      expect(log).toContainEqual('2026-11-23T14:01:00.000Z implemented #1')
      expect(log).toContainEqual(expect.stringMatching(/--- run started, resume of 1 session$/))
      expect(log.filter((line) => !line.includes('---'))).toHaveLength(lines.length)
    })

    it('says in run.log why each session resumed', async () => {
      let fails = true
      const { ports } = portsFor([ticket(1)], (session, fake) =>
        session.role === 'implementer' && fails ? 0 : succeeds(session, fake)
      )
      await runSpec(100, {}, ports)
      fails = false

      await runSpec(100, {}, ports)

      expect(runLog()).toContainEqual(
        expect.stringMatching(
          /resumed #1 implementer because it exited 0 but failed the done check: no-commits \(log /
        )
      )
    })
  })

  describe('progress', () => {
    it('hands the progress port the state after every change, ending with the saved state', async () => {
      const { ports, shown } = portsFor([ticket(1)])

      await runSpec(100, {}, ports)

      const statuses = shown.map((state) => state.tickets[1].status)
      expect(statuses.filter((status, i) => status !== statuses[i - 1])).toEqual([
        'pending',
        'running',
        'implemented',
        'done'
      ])
      expect(shown.at(-1)).toEqual(readState(100))
    })
  })

  describe('resuming on a re-run', () => {
    const interrupted = new Error('run interrupted')

    /**
     * Simulates the process dying mid-session: `kill` snapshots the state file and throws out of
     * the session; once the run has settled, `restore` puts the snapshot back, as a killed process
     * would have left the state file.
     */
    const crashPoint = () => {
      let snapshot: string | undefined
      const file = () => join(root, '.implement-spec', '100', 'state.json')
      return {
        kill: (): never => {
          snapshot = readFileSync(file(), 'utf8')
          throw interrupted
        },
        restore: () => {
          if (snapshot !== undefined) writeFileSync(file(), snapshot)
        }
      }
    }

    it('resumes an implementer left running with its saved session ID in its worktree, telling it why', async () => {
      let crash = true
      const point = crashPoint()
      const { ports, claude } = portsFor(
        [ticket(1), ticket(2, [{ number: 1, open: true }])],
        (session, fake) => {
          if (crash && session.role === 'implementer') {
            crash = false
            point.kill()
          }
          return succeeds(session, fake)
        }
      )
      await runSpec(100, {}, ports)
      point.restore()
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

    /**
     * A run of `tickets` whose git merges are clean and whose first checks run is killed after the
     * merge committed, leaving a ticket `implemented` with no merger. Later checks runs answer from
     * `rerun`.
     */
    const interruptedDuringChecks = async (
      tickets: Ticket[],
      rerun: () => ChecksResult = () => ({ passed: true })
    ) => {
      let crash = true
      const point = crashPoint()
      const run = portsFor(tickets, succeeds, {
        merge: () => ({ result: 'clean' }),
        checks: () => {
          if (crash) {
            crash = false
            point.kill()
          }
          clock.at += 2 * MINUTE
          return rerun()
        }
      })
      await runSpec(100, {}, run.ports)
      point.restore()
      expect(readState(100).tickets[1]).toMatchObject({
        status: 'implemented',
        gitMerge: { startedAt: START }
      })
      expect(readState(100).tickets[1].merger).toBeUndefined()
      run.git.merges.length = 0
      run.checks.runs.length = 0
      run.claude.sessions.length = 0
      lines.length = 0
      return run
    }

    it('runs the checks with no git merge for a ticket the integration branch already contains, then marks it done and publishes', async () => {
      const { ports, git, checks, claude, tracker } = await interruptedDuringChecks([ticket(1)])

      const result = await runSpec(100, {}, ports)

      expect(result.ok).toBe(true)
      expect(git.merges).toEqual([])
      expect(git.aborts).toEqual([])
      const [integration] = integrationWorktrees(git)
      expect(checks.runs).toEqual([
        {
          cwd: integration.path,
          logFile: join(root, '.implement-spec', '100', 'logs', 'checks-1.log')
        }
      ])
      expect(claude.sessions.map(({ role }) => role)).not.toContain('merger')
      const state = readState(100)
      expect(state.tickets[1].status).toBe('done')
      expect(state.tickets[1].merger).toBeUndefined()
      expect(state.tickets[1].gitMerge.checks).toEqual({ passed: true })
      expect(git.removed).toContain(join(root, '.claude', 'worktrees', 'implement-spec-100-1'))
      expect(git.pushed.map(({ branch }) => branch)).toContain('implement-spec/100')
      expect(tracker.prs).toHaveLength(1)
      expect(lines).toContain('merged #1 by git, checks passed')
    })

    it('fails the merge as after a fresh clean merge when the re-run checks fail', async () => {
      const { ports, git, claude, tracker } = await interruptedDuringChecks(
        [ticket(1), ticket(2, [{ number: 1, open: true }])],
        () => ({ passed: false, step: 'test' })
      )

      const result = await runSpec(100, {}, ports)

      expect(result.ok).toBe(false)
      expect(git.merges).toEqual([])
      expect(claude.sessions).toEqual([])
      const state = readState(100)
      expect(state.tickets[1]).toMatchObject({
        status: 'implemented',
        gitMerge: { checks: { passed: false, step: 'test' } }
      })
      expect(state.tickets[1].merger).toBeUndefined()
      expect(state.tickets[2].status).toBe('pending')
      expect(tracker.prs).toEqual([])
      const log = join(root, '.implement-spec', '100', 'logs', 'checks-1.log')
      expect(lines.slice(lines.indexOf('failed tickets:') + 1)).toEqual([
        `  #1 checks test (log ${log})`
      ])
    })

    it('still git merges a ticket left implemented that the integration branch does not contain', async () => {
      let crash = true
      const point = crashPoint()
      const { ports, git, checks } = portsFor([ticket(1)], succeeds, {
        merge: () => {
          if (crash) {
            crash = false
            point.kill()
          }
          return { result: 'clean' }
        }
      })
      await runSpec(100, {}, ports)
      point.restore()
      expect(readState(100).tickets[1].status).toBe('implemented')
      git.merges.length = 0

      const result = await runSpec(100, {}, ports)

      expect(result.ok).toBe(true)
      expect(git.merges).toEqual(['implement-spec/100-1'])
      expect(checks.runs).toHaveLength(1)
      expect(readState(100).tickets[1].status).toBe('done')
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
        resume: true,
        model: 'opus'
      })
      expect(resumed?.prompt).toMatch(/exited with code 1/)
      // The resume makes no git attempt, so its prompt has no section on why git couldn't merge.
      expect(resumed?.prompt).toContain(failedMerger?.prompt.split('\n\nThe script tried')[0])
      expect(resumed?.prompt).toContain('1. Merge implement-spec/100-1 into implement-spec/100')
      expect(resumed?.prompt).not.toMatch(/The script tried/)
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

    it('starts a fresh session with a new saved ID when the session to resume was never saved by claude', async () => {
      const persisted = new Set<string>()
      let crash = true
      const point = crashPoint()
      const savedAtLaunch: boolean[] = []
      const { ports, claude } = portsFor([ticket(1)], (session, fake) => {
        if (session.resume && !persisted.has(session.sessionId)) return 'no-session'
        savedAtLaunch.push(JSON.stringify(readState(100)).includes(`"${session.sessionId}"`))
        if (crash && session.role === 'implementer') {
          crash = false
          point.kill()
        }
        persisted.add(session.sessionId)
        return succeeds(session, fake)
      })
      await runSpec(100, {}, ports)
      point.restore()

      const result = await runSpec(100, {}, ports)

      expect(result.ok).toBe(true)
      const [first, resumed, fresh] = claude.sessions
      expect(resumed).toMatchObject({ sessionId: first.sessionId, resume: true })
      expect(resumed.model).toBe('sonnet')
      expect(fresh).toMatchObject({
        role: 'implementer',
        model: 'sonnet',
        cwd: first.cwd,
        resume: false
      })
      expect(fresh.sessionId).not.toBe(first.sessionId)
      expect(fresh.prompt).toContain(first.prompt)
      expect(savedAtLaunch.every(Boolean)).toBe(true)
      expect(readState(100).tickets[1].session).toMatchObject({
        id: fresh.sessionId,
        outcome: { check: 'passed' }
      })
      expect(lines).toContainEqual(expect.stringMatching(/no saved session.*#1 implementer/))
    })

    it('waits for a usage limit to reset, then resumes the same session', async () => {
      const resetsAt = Date.parse('2026-11-24T05:20:00Z')
      let limited = true
      const { ports, claude, waits } = portsFor([ticket(1)], (session, fake) => {
        if (session.role === 'implementer' && limited) {
          limited = false
          return { usageLimitResetsAt: resetsAt }
        }
        return succeeds(session, fake)
      })

      const result = await runSpec(100, {}, ports)

      expect(result.ok).toBe(true)
      expect(waits).toEqual([resetsAt + USAGE_LIMIT_GRACE_MS])
      const [first, resumed] = claude.sessions.filter(({ role }) => role === 'implementer')
      expect(resumed).toMatchObject({
        sessionId: first.sessionId,
        resume: true,
        cwd: first.cwd,
        model: 'sonnet'
      })
      expect(resumed.prompt).toContain('usage limit')
      expect(resumed.prompt).toContain(first.prompt)
      expect(readState(100).tickets[1].status).toBe('done')
      expect(lines).toContainEqual(expect.stringMatching(/usage limit hit by #1 implementer/))
    })

    it('starts fresh when a session stopped by a usage limit was never saved by claude', async () => {
      let limited = true
      const { ports, claude } = portsFor([ticket(1)], (session, fake) => {
        if (session.role !== 'implementer') return succeeds(session, fake)
        if (limited) {
          limited = false
          return { usageLimitResetsAt: 0 }
        }
        if (session.resume) return 'no-session'
        return succeeds(session, fake)
      })

      const result = await runSpec(100, {}, ports)

      expect(result.ok).toBe(true)
      const [first, resumed, fresh] = claude.sessions.filter(({ role }) => role === 'implementer')
      expect(resumed).toMatchObject({ sessionId: first.sessionId, resume: true })
      expect(fresh).toMatchObject({ resume: false, model: 'sonnet' })
      expect(fresh.sessionId).not.toBe(first.sessionId)
      expect(fresh.prompt).toContain('usage limit')
    })

    it('re-queues tickets left implemented in the order their implementers finished', async () => {
      let mergerFails = true
      const finishDelay: Record<string, number> = { '1': 20, '2': 10, '3': 0 }
      const { ports, claude } = portsFor(
        [ticket(1), ticket(2), ticket(3)],
        async (session, fake) => {
          if (session.role === 'implementer') {
            const n = session.cwd.slice(-1)
            await new Promise((resolve) => setTimeout(resolve, finishDelay[n]))
          }
          if (session.role === 'merger' && mergerFails) return 1
          return succeeds(session, fake)
        }
      )
      await runSpec(100, {}, ports)
      expect([1, 2].map((n) => readState(100).tickets[n].status)).toEqual([
        'implemented',
        'implemented'
      ])
      mergerFails = false
      const before = claude.sessions.length

      expect((await runSpec(100, {}, ports)).ok).toBe(true)

      const mergers = claude.sessions
        .slice(before)
        .filter(({ role }) => role === 'merger')
        .map(({ logFile }) => logFile.slice(-6, -4))
      expect(mergers).toEqual(['-3', '-2', '-1'])
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

    it('finishes a re-run after the ready step threw once the PR was already marked ready', async () => {
      const { ports, git, tracker } = portsFor([ticket(1)])
      const removeWorktree = git.git.removeWorktree
      let broken = true
      git.git.removeWorktree = async (path) => {
        if (broken && path.endsWith('implement-spec-100')) throw new Error('worktree busy')
        return removeWorktree(path)
      }
      await expect(runSpec(100, {}, ports)).rejects.toThrow('worktree busy')
      expect(tracker.ready).toEqual([500])
      broken = false

      const result = await runSpec(100, {}, ports)

      expect(result.ok).toBe(true)
      expect(tracker.ready).toEqual([500])
      expect(readState(100).steps.ready).toEqual({ status: 'done' })
      expect(git.worktrees.size).toBe(0)
    })

    it('does no work on a re-run of a finished run', async () => {
      const { ports, claude, git, tracker, shown } = portsFor([ticket(1)])
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
      shown.length = 0

      const result = await runSpec(100, { explore: true }, ports)

      expect(result.ok).toBe(true)
      expect(counts()).toEqual(before)
      expect(readState(100)).toEqual(stateAfterFirst)
      expect(lines).toEqual([expect.stringMatching(/already finished.*PR #500/)])
      expect(shown).toEqual([stateAfterFirst])
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

    it('fails only the ticket whose git call throws while launching it, and launches it again on a re-run', async () => {
      const { ports, git } = portsFor([
        ticket(1),
        ticket(2),
        ticket(3, [{ number: 1, open: true }])
      ])
      const addWorktree = git.git.addWorktree
      let broken = true
      git.git.addWorktree = async (path, branch, base) => {
        if (broken && branch.endsWith('-1')) throw new Error('disk full')
        return addWorktree(path, branch, base)
      }

      const result = await runSpec(100, {}, ports)

      expect(result.ok).toBe(false)
      const state = readState(100)
      expect([1, 2, 3].map((n) => state.tickets[n].status)).toEqual(['failed', 'done', 'pending'])
      expect(state.tickets[1].session.outcome).toMatchObject({ check: 'error', error: 'disk full' })
      expect(lines).toContainEqual(
        expect.stringMatching(/^failed #1 implementer: error: disk full/)
      )
      expect(lines).toContainEqual(expect.stringMatching(/^ {2}#1 implementer error \(log /))

      broken = false
      expect((await runSpec(100, {}, ports)).ok).toBe(true)
      expect([1, 2, 3].map((n) => readState(100).tickets[n].status)).toEqual([
        'done',
        'done',
        'done'
      ])
    })

    it('treats a git call that throws while merging as a failed merger', async () => {
      const { ports, git, claude } = portsFor([ticket(1), ticket(2, [{ number: 1, open: true }])])
      const head = git.git.head
      let broken = true
      git.git.head = async (branch) => {
        if (broken && branch === 'implement-spec/100-1') throw new Error('bad ref')
        return head(branch)
      }

      const result = await runSpec(100, {}, ports)

      expect(result.ok).toBe(false)
      expect(claude.sessions.map(({ role }) => role)).toEqual(['implementer'])
      const state = readState(100)
      expect(state.tickets[1]).toMatchObject({
        status: 'implemented',
        merger: { outcome: { check: 'error', error: 'bad ref' } }
      })
      expect(lines).toContainEqual(expect.stringMatching(/^ {2}#1 merger error \(log /))

      broken = false
      expect((await runSpec(100, {}, ports)).ok).toBe(true)
    })

    it('fails a run that stalls with no failure, naming each ticket left stuck and its open blockers', async () => {
      const { ports, claude, tracker } = portsFor([
        ticket(1),
        ticket(2, [{ number: 90, open: true }]),
        ticket(3, [{ number: 2, open: true }])
      ])

      const result = await runSpec(100, {}, ports)

      expect(result.ok).toBe(false)
      expect(claude.sessions.map(({ role }) => role)).toEqual(['implementer', 'merger'])
      expect(tracker.ready).toEqual([])
      const summary = lines.slice(lines.indexOf('stuck tickets:'))
      expect(summary).toEqual(['stuck tickets:', '  #2 blocked by #90', '  #3 blocked by #2'])
    })

    it('ignores a ticket closed on GitHub since an earlier run, finishing once every open ticket is done', async () => {
      const tickets = [ticket(1), ticket(2, [{ number: 90, open: true }])]
      const { ports, tracker } = portsFor(tickets)
      expect((await runSpec(100, {}, ports)).ok).toBe(false)
      tickets.pop()
      lines.length = 0

      const result = await runSpec(100, {}, ports)

      expect(result.ok).toBe(true)
      expect(tracker.ready).toEqual([500])
      expect(lines).not.toContainEqual(expect.stringMatching(/#2 blocked/))
    })

    it('fails a spec with no open tickets without cutting a branch or running any session', async () => {
      const { ports, claude, git, tracker } = portsFor([])

      const result = await runSpec(100, {}, ports)

      expect(result).toEqual({ ok: false, frontier: [] })
      expect(claude.sessions).toEqual([])
      expect(git.added).toEqual([])
      expect(tracker.prs).toEqual([])
      expect(lines).toEqual(['spec #100 has no open tickets'])
    })

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
