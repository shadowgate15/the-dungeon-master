import { describe, expect, it, vi } from 'vitest'
import type { SceneState, SessionEvent } from '#lib/session/enums.ts'
import { estimateTokens } from '../../ai/tokens.ts'
import { DEFAULT_BUDGETS } from './budgets.ts'
import { buildNarratorContext } from './narrator.ts'
import type { WorldRecords } from './world-selection.ts'

const scene = (over: Partial<SceneState> = {}): SceneState => ({
  location: { name: 'The Tavern', description: 'A smoky room.' },
  exits: [{ id: 'door', name: 'Front door' }],
  objects: ['a barrel'],
  npcs: [
    {
      id: 'n1',
      key: 'mira',
      name: 'Mira',
      attitude: 'friendly',
      knowledge: 'SECRET-NOTE the cellar hides a key.'
    }
  ],
  mode: 'exploration',
  dialogueNpcId: null,
  pendingRoll: null,
  ...over
})

const event = (seq: number, text: string, over: Partial<SessionEvent> = {}): SessionEvent => ({
  id: `e${seq}`,
  sessionId: 's',
  seq,
  role: 'narrator',
  kind: 'narration',
  text,
  npcId: null,
  data: null,
  createdAt: seq,
  ...over
})

const events = (n: number, size = 40) =>
  Array.from({ length: n }, (_, i) => event(i + 1, `Event ${i + 1}. ${'w'.repeat(size)}`))

const world = (over: Partial<WorldRecords> = {}): WorldRecords => ({
  places: [],
  npcs: [
    {
      id: 'n1',
      name: 'Mira',
      role: 'Innkeeper',
      description: 'Mira keeps the inn.',
      status: 'alive',
      retired: false,
      recent: false
    }
  ],
  facts: [],
  ...over
})

const build = (over: Partial<Parameters<typeof buildNarratorContext>[0]> = {}) =>
  buildNarratorContext({
    scene: scene(),
    events: events(3),
    summary: { text: null, throughSeq: 0 },
    world: world(),
    ...over
  })

const whole = (c: { system: string; content: string }) => `${c.system}\n${c.content}`

describe('the Narrator context', () => {
  it('holds the Scene, the Arc block, World memory and the events, and no per-NPC knowledge', () => {
    const c = build({ arcBlock: 'Story arc: The Long Night' })
    const text = whole(c)
    expect(text).toContain('The Tavern')
    expect(text).toContain('Story arc: The Long Night')
    expect(text).toContain('Mira (Innkeeper)')
    expect(text).toContain('Event 3.')
    expect(text).not.toContain('SECRET-NOTE')
  })

  it('shows the summary and only events after its watermark, plus the last 8 when covered', () => {
    const c = build({
      events: events(20),
      summary: { text: 'Earlier the party arrived.', throughSeq: 18 }
    })
    expect(c.system + c.content).toContain('Earlier the party arrived.')
    // Events 19 and 20 are uncovered; the floor keeps 13-18 verbatim too.
    expect(c.content).toContain('Event 13.')
    expect(c.content).not.toContain('Event 12.')
    expect(c.report).toMatchObject({ verbatim: 8, summarised: 12 })
  })

  it('shows every uncovered event verbatim even beyond the floor', () => {
    const c = build({ events: events(12), summary: { text: 'Earlier.', throughSeq: 2 } })
    expect(c.content).toContain('Event 3.')
    expect(c.content).not.toContain('Event 2.')
    expect(c.report).toMatchObject({ verbatim: 10, summarised: 2 })
  })

  it('stays under its cap and reports usage', () => {
    const c = build({ events: events(60, 200), summary: { text: 'S. '.repeat(50), throughSeq: 0 } })
    expect(estimateTokens(whole(c))).toBeLessThanOrEqual(DEFAULT_BUDGETS.narrator)
    expect(c.report.used).toBe(estimateTokens(whole(c)))
    expect(c.report.cap).toBe(DEFAULT_BUDGETS.narrator)
    expect(c.report.memoryBudget).toBe(DEFAULT_BUDGETS.memory)
  })
})

describe('over-cap trim order', () => {
  const manyFacts = world({
    facts: Array.from({ length: 12 }, (_, i) => ({
      id: `f${i}`,
      title: `Rumour ${i}`,
      detail: 'd'.repeat(120),
      worldChanging: false,
      recent: false,
      npcIds: []
    }))
  })
  const budgets = (narrator: number) => ({ ...DEFAULT_BUDGETS, narrator })

  const total = (c: ReturnType<typeof build>) => c.report.used

  it('trims World memory first, then events to the floor, then the summary tail', () => {
    const summary = { text: 'First thing. Second thing. Third thing.', throughSeq: 0 }
    const full = build({ world: manyFacts, events: events(10), summary, budgets: budgets(100000) })
    const noMemory = build({
      world: world(),
      events: events(10),
      summary,
      budgets: budgets(100000)
    })

    // Just under full: only memory trims.
    let c = build({
      world: manyFacts,
      events: events(10),
      summary,
      budgets: budgets(total(full) - 20)
    })
    expect(c.report.trims.memory).toBeGreaterThan(0)
    expect(c.report.trims).toMatchObject({ events: 0, summary: 0 })

    // Below memory-free: events go, oldest first, but the summary stays whole.
    c = build({
      world: manyFacts,
      events: events(10),
      summary,
      budgets: budgets(total(noMemory) - 30)
    })
    expect(c.report.trims.events).toBeGreaterThan(0)
    expect(c.report.trims.summary).toBe(0)
    expect(c.content).toContain('Event 10.')
    expect(c.content).not.toContain('Event 1.')

    // Tiny cap: events stop at the floor of 4, then the summary tail is cut.
    const floorOnly = build({
      world: world(),
      events: events(10).slice(-DEFAULT_BUDGETS.trimFloor),
      budgets: budgets(100000)
    })
    c = build({
      world: manyFacts,
      events: events(10),
      summary,
      budgets: budgets(total(floorOnly) + 14)
    })
    expect(c.report.verbatim).toBe(DEFAULT_BUDGETS.trimFloor)
    expect(c.report.trims.summary).toBeGreaterThan(0)
    expect(c.content).toContain('First thing.')
    expect(c.content).not.toContain('Third thing.')
  })

  it('never trims the Scene, Arc, Seed or Character, even over the ceiling', () => {
    const c = build({
      arcBlock: 'ARC-BLOCK',
      fixed: { seed: 'SEED-TEXT', character: 'CHARACTER-SHEET' },
      budgets: budgets(1)
    })
    const text = whole(c)
    for (const kept of ['ARC-BLOCK', 'SEED-TEXT', 'CHARACTER-SHEET', 'The Tavern', 'Front door']) {
      expect(text).toContain(kept)
    }
  })

  it('keeps the core of World memory when memory is trimmed', () => {
    const c = build({
      world: world({
        facts: [
          {
            id: 'f',
            title: 'Bridge fell',
            detail: 'The bridge fell.',
            worldChanging: true,
            recent: false,
            npcIds: []
          }
        ]
      }),
      budgets: budgets(1)
    })
    expect(whole(c)).toContain('Bridge fell')
    expect(whole(c)).toContain('Mira (Innkeeper)')
  })
})

describe('summaries that keep failing', () => {
  it('drops the oldest uncovered events from context, with a console line, and counts them', () => {
    const log = vi.fn()
    const c = build({
      events: events(40, 300),
      summary: { text: null, throughSeq: 0 },
      budgets: { ...DEFAULT_BUDGETS, narrator: 800 },
      log
    })
    expect(c.report.trims.uncovered).toBeGreaterThan(0)
    expect(c.content).toContain('Event 40.')
    expect(c.content).not.toContain('Event 1.')
    expect(log).toHaveBeenCalledTimes(1)
    expect(log.mock.calls[0][0]).toMatch(/uncovered/)
  })

  it('does not log when nothing uncovered was dropped', () => {
    const log = vi.fn()
    build({ log })
    expect(log).not.toHaveBeenCalled()
  })
})
