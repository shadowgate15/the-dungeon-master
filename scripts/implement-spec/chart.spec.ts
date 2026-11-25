import { describe, expect, it } from 'vitest'
import { render, type ChartOptions } from './chart.ts'
import type { GitMergeState, RunState, SessionState, Ticket } from './run-spec.ts'

const START = Date.parse('2026-11-23T14:00:00Z')
const MINUTE = 60 * 1000

const ticket = (number: number, blockedBy: number[] = [], title = `Ticket ${number}`): Ticket => ({
  number,
  title,
  blockedBy: blockedBy.map((blocker) => ({ number: blocker, open: true }))
})

/** A session that ran from `from` to `to` minutes after START, with an outcome when given. */
const ran = (from: number, to?: number, extra: Partial<SessionState> = {}): SessionState => ({
  id: 'session',
  startedAt: START + from * MINUTE,
  ...(to === undefined ? {} : { endedAt: START + to * MINUTE }),
  attempts: 1,
  ...extra
})

const passed = { exitCode: 0, check: 'passed' } as const

const stateWith = (tickets: RunState['tickets'], extra: Partial<RunState> = {}): RunState => ({
  spec: 100,
  integrationBranch: 'implement-spec/100',
  integrationWorktree: '/repo/.claude/worktrees/implement-spec-100',
  tickets,
  runs: [{ startedAt: START, endedAt: START }],
  ...extra
})

const options = (extra: Partial<ChartOptions> = {}): ChartOptions => ({
  now: START + 30 * MINUTE,
  width: 100,
  height: 40,
  color: false,
  live: true,
  timeZone: 'UTC',
  ...extra
})

describe('render', () => {
  it('lists tickets in dependency layers, with their open blockers, above the end-of-run steps', () => {
    const tickets = [ticket(1), ticket(2, [1]), ticket(3, [1, 2]), ticket(4, [90])]
    const state = stateWith({
      1: { status: 'pending' },
      2: { status: 'pending' },
      3: { status: 'pending' },
      4: { status: 'pending' }
    })

    expect(render(state, tickets, options())).toMatchInlineSnapshot(`
      "spec #100 · 30m
      layer 0
        · #1 Ticket 1  pending
        · #4 Ticket 4  pending · blocked by #90
      layer 1
        · #2 Ticket 2  pending · blocked by #1
      layer 2
        · #3 Ticket 3  pending · blocked by #1 #2
      finish
        · review
        · fix
        · pr-description
        · ready"
    `)
  })

  it("shows each ticket's status with its times, attempts, queue place and log", () => {
    const tickets = [1, 2, 3, 4, 5, 6, 7, 8].map((number) => ticket(number))
    const failedMerge = { exitCode: 0, check: 'not-merged' } as const
    const state = stateWith(
      {
        1: { status: 'done', session: ran(0, 12, { outcome: passed }), merger: ran(12, 14) },
        2: {
          status: 'running',
          session: ran(20, undefined, { attempts: 2, activeMs: 3 * MINUTE })
        },
        3: {
          status: 'failed',
          session: ran(0, 5, { outcome: { exitCode: 0, check: 'no-commits' } })
        },
        4: { status: 'implemented', session: ran(0, 8, { outcome: passed }), finishOrder: 2 },
        5: { status: 'implemented', session: ran(0, 6, { outcome: passed }), finishOrder: 1 },
        6: { status: 'implemented', session: ran(0, 9, { outcome: passed }), merger: ran(25) },
        7: { status: 'running', session: ran(0, 7, { waitingUntil: START + 53 * MINUTE }) },
        8: {
          status: 'implemented',
          session: ran(0, 4, { outcome: passed }),
          merger: ran(14, 15, { outcome: failedMerge })
        }
      },
      {
        pr: 500,
        steps: {
          explore: { status: 'done', session: ran(0, 3, { outcome: passed }) },
          review: { status: 'running', session: ran(10, 12, { waitingUntil: START + 40 * MINUTE }) }
        },
        runs: [{ startedAt: START, endedAt: START + 10 * MINUTE }]
      }
    )

    expect(render(state, tickets, options({ width: 120 }))).toMatchInlineSnapshot(`
      "spec #100 · PR #500 draft · 30m
      explore
        ✓ explore      3m
      layer 0
        ✓ #1 Ticket 1  impl 12m · merge 2m
        ◐ #2 Ticket 2  impl 13m (attempt 2) · .implement-spec/100/logs/implementer-2.log
        ✗ #3 Ticket 3  no-commits · impl 5m · .implement-spec/100/logs/implementer-3.log
        ● #4 Ticket 4  queued 2 · impl 8m
        ● #5 Ticket 5  queued 1 · impl 6m
        ◐ #6 Ticket 6  impl 9m · merge 5m · .implement-spec/100/logs/merger-6.log
        ⏸ #7 Ticket 7  usage limit · resumes 14:53 (23m) · .implement-spec/100/logs/implementer-7.log
        ✗ #8 Ticket 8  merge not-merged · impl 4m · .implement-spec/100/logs/merger-8.log
      finish
        ⏸ review       usage limit · resumes 14:40 (10m) · .implement-spec/100/logs/reviewer.log
        · fix
        · pr-description
        · ready"
    `)
  })

  it('shows sessions a stopped run left open as interrupted, timed to its last save', () => {
    const tickets = [ticket(1), ticket(2), ticket(3)]
    const state = stateWith(
      {
        1: { status: 'running', session: ran(0) },
        2: { status: 'implemented', session: ran(0, 9, { outcome: passed }), merger: ran(10) },
        3: { status: 'running', session: ran(0, 5, { waitingUntil: START + 60 * MINUTE }) }
      },
      { runs: [{ startedAt: START, endedAt: START + 20 * MINUTE }] }
    )

    expect(
      render(state, tickets, options({ width: 120, live: false, verdict: true })).split('\n')
    ).toEqual([
      'spec #100 · 20m',
      'layer 0',
      '  ✗ #1 Ticket 1  interrupted · impl 20m · .implement-spec/100/logs/implementer-1.log',
      '  ✗ #2 Ticket 2  merge interrupted · impl 9m · merge 10m · .implement-spec/100/logs/merger-2.log',
      '  ✗ #3 Ticket 3  interrupted · impl 5m · .implement-spec/100/logs/implementer-3.log',
      'finish',
      '  · review',
      '  · fix',
      '  · pr-description',
      '  · ready',
      '✗ 3 interrupted — re-run to resume · 20m'
    ])
  })

  it('shows tickets merged by git: the checks duration, running, failed with the checks log, then a merger', () => {
    const tickets = [1, 2, 3, 4, 5].map((number) => ticket(number))
    const gitMerge = (from: number, to?: number, checks?: GitMergeState['checks']) => ({
      startedAt: START + from * MINUTE,
      ...(to === undefined ? {} : { endedAt: START + to * MINUTE }),
      ...(checks === undefined ? {} : { checks })
    })
    const lintFailed = { passed: false, step: 'lint' } as const
    const implemented = (finishOrder: number) =>
      ({ status: 'implemented', session: ran(0, 8, { outcome: passed }), finishOrder }) as const
    const state = stateWith({
      1: {
        status: 'done',
        session: ran(0, 12, { outcome: passed }),
        gitMerge: gitMerge(12, 16, { passed: true })
      },
      2: { ...implemented(1), gitMerge: gitMerge(20) },
      3: { ...implemented(2), gitMerge: gitMerge(12, 15, lintFailed) },
      4: {
        status: 'done',
        session: ran(0, 8, { outcome: passed }),
        gitMerge: gitMerge(10, 13, lintFailed),
        merger: ran(13, 18, { outcome: passed })
      },
      5: implemented(3)
    })

    expect(render(state, tickets, options({ width: 120 }))).toMatchInlineSnapshot(`
      "spec #100 · 30m
      layer 0
        ✓ #1 Ticket 1  impl 12m · merge (git) 4m
        ◐ #2 Ticket 2  impl 8m · merge (git) 10m
        ✗ #3 Ticket 3  checks lint · impl 8m · merge (git) 3m · .implement-spec/100/logs/checks-3.log
        ✓ #4 Ticket 4  impl 8m · merge 5m
        ● #5 Ticket 5  queued 1 · impl 8m
      finish
        · review
        · fix
        · pr-description
        · ready"
    `)
  })

  it('shows checks a stopped run left running as interrupted', () => {
    const state = stateWith(
      {
        1: {
          status: 'implemented',
          session: ran(0, 8, { outcome: passed }),
          gitMerge: { startedAt: START + 10 * MINUTE }
        }
      },
      { runs: [{ startedAt: START, endedAt: START + 20 * MINUTE }] }
    )

    const [, , row] = render(state, [ticket(1)], options({ live: false })).split('\n')

    expect(row).toBe('  ✗ #1 Ticket 1  merge interrupted · impl 8m · merge (git) 10m')
  })

  it('shows a dash for the total time of a run from before times were recorded', () => {
    const state = stateWith({ 1: { status: 'pending' } }, { runs: undefined })

    expect(render(state, [ticket(1)], options()).split('\n')[0]).toBe('spec #100 · —')
  })

  it('cuts a title that would push its row past the terminal width', () => {
    const tickets = [ticket(1, [], 'A very long ticket title that will not fit')]
    const state = stateWith({ 1: { status: 'pending' } })

    const [, , row] = render(state, tickets, options({ width: 40 })).split('\n')

    expect(row).toBe('  · #1 A very long ticket titl…  pending')
  })

  it('collapses finished layers, top first, then cuts what still does not fit', () => {
    const tickets = [ticket(1), ticket(2), ticket(3, [1]), ticket(4, [3])]
    const state = stateWith({
      1: { status: 'done' },
      2: { status: 'done' },
      3: { status: 'done' },
      4: { status: 'pending' }
    })

    expect(render(state, tickets, options({ height: 11 }))).toMatchInlineSnapshot(`
      "spec #100 · 30m
      ✓ layer 0: 2 done
      layer 1
        ✓ #3 Ticket 3
      layer 2
        · #4 Ticket 4  pending
      finish
        · review
        · fix
        · pr-description
        · ready"
    `)
    expect(render(state, tickets, options({ height: 8 }))).toMatchInlineSnapshot(`
      "spec #100 · 30m
      ✓ layer 0: 2 done
      ✓ layer 1: 1 done
      layer 2
        · #4 Ticket 4  pending
      finish
        · review
        … 3 more lines"
    `)
  })

  it('ends with the verdict when asked: the ready PR, or what failed, is stuck or never started', () => {
    const runs = [{ startedAt: START, endedAt: START + 112 * MINUTE }]
    const finished = stateWith(
      { 1: { status: 'done' } },
      { pr: 500, prReady: true, runs, steps: { ready: { status: 'done' } } }
    )
    const failed = stateWith(
      { 1: { status: 'failed' }, 2: { status: 'pending' }, 3: { status: 'pending' } },
      { runs }
    )

    const last = (state: RunState, tickets: Ticket[]) =>
      render(state, tickets, options({ live: false, verdict: true }))
        .split('\n')
        .at(-1)

    expect(last(finished, [ticket(1)])).toBe('✓ PR #500 ready · 1h 52m')
    expect(last(failed, [ticket(1), ticket(2, [1]), ticket(3)])).toBe(
      '✗ 1 failed, 1 stuck, 1 not started — re-run to resume · 1h 52m'
    )
  })

  it('colors the status glyphs only when asked', () => {
    const state = stateWith({ 1: { status: 'done' } })

    const [, , row] = render(state, [ticket(1)], options({ color: true })).split('\n')

    expect(row).toBe('  \x1b[32m✓\x1b[0m #1 Ticket 1')
  })
})
