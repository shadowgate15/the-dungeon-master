import { describe, expect, it } from 'vitest'
import { estimateTokens } from '../ai/tokens.ts'
import {
  GONE_LINE_MAX,
  MEMORY_BUDGET_SHARE,
  buildMemoryBlock,
  memoryBudget,
  type MemoryInput,
  type MemoryNpc,
  type MemoryFact
} from './context.ts'

let n = 0
const stamp = (over: { changedSeq?: number; updatedAt?: number; session?: string } = {}) => ({
  createdSessionId: over.session ?? 's1',
  changedSessionId: over.session ?? 's1',
  changedSeq: over.changedSeq ?? 1,
  updatedAt: over.updatedAt ?? 1,
  retiredAt: null as number | null
})
const npc = (name: string, over: Partial<MemoryNpc> = {}): MemoryNpc => ({
  id: `npc-${++n}`,
  name,
  description: `${name} is here.`,
  role: null,
  status: 'alive',
  placeId: null,
  stance: null,
  note: null,
  knowsFactIds: [],
  ...stamp(),
  ...over
})
const fact = (title: string, over: Partial<MemoryFact> = {}): MemoryFact => ({
  id: `fact-${++n}`,
  title,
  detail: null,
  worldChanging: false,
  supersededById: null,
  ...stamp(),
  ...over
})
const input = (over: Partial<MemoryInput> = {}): MemoryInput => ({
  npcs: [],
  places: [],
  factions: [],
  events: [],
  facts: [],
  window: [],
  focus: { sessionId: 's9', seq: 100 },
  ...over
})
const BIG = 100_000

describe('memory budget', () => {
  it('pins the share to a quarter of the remaining context', () => {
    expect(MEMORY_BUDGET_SHARE).toBe(0.25)
    expect(memoryBudget(1000)).toBe(250)
  })
})

describe('buildMemoryBlock', () => {
  it('is null with no memory, and with only retired or superseded records', () => {
    expect(buildMemoryBlock(input(), BIG)).toBeNull()
    expect(
      buildMemoryBlock(
        input({
          facts: [
            fact('Old', { worldChanging: true, retiredAt: 5 }),
            fact('Replaced', { worldChanging: true, supersededById: 'x' })
          ]
        }),
        BIG
      )
    ).toBeNull()
  })

  it('states that memory wins over the summary', () => {
    const block = buildMemoryBlock(input({ npcs: [npc('Mira', { stance: 'friendly' })] }), BIG)!
    expect(block).toMatch(/memory wins/i)
  })

  it('always includes NPCs with an allied, friendly or hostile stance, not wary or neutral', () => {
    const block = buildMemoryBlock(
      input({
        npcs: [
          npc('Allie', { stance: 'allied' }),
          npc('Frida', { stance: 'friendly' }),
          npc('Hostus', { stance: 'hostile' }),
          npc('Wanda', { stance: 'wary' }),
          npc('Nell', { stance: 'neutral' })
        ]
      }),
      BIG
    )!
    for (const name of ['Allie', 'Frida', 'Hostus']) expect(block).toContain(name)
    for (const name of ['Wanda', 'Nell']) expect(block).not.toContain(name)
  })

  it('includes NPCs mentioned in the window (case-insensitive, whole words only)', () => {
    const npcs = [npc('Brom'), npc('Al'), npc('Zed')]
    const block = buildMemoryBlock(input({ npcs, window: ['I ask BROM about the algae.'] }), BIG)!
    expect(block).toContain('Brom')
    expect(block).not.toContain('Al (')
    expect(block).not.toContain('Zed')
  })

  it('always includes world-changing facts, and selects plain ones by recent change', () => {
    const wc = fact('The bridge fell', { worldChanging: true })
    const plain = fact('Cats are common')
    const recent = fact('Fresh rumor', stamp({ session: 's9', changedSeq: 99 }))
    const block = buildMemoryBlock(input({ facts: [wc, plain, recent] }), BIG)!
    expect(block).toContain('The bridge fell')
    expect(block).toContain('Fresh rumor')
    expect(block).not.toContain('Cats are common')
  })

  it('selects one-hop links of selected records: an NPC place and known facts', () => {
    const f = fact('Brom hides a key')
    const place = { id: 'pl1', name: 'Rusty Anchor', description: 'A tavern.', ...stamp() }
    const brom = npc('Brom', { knowsFactIds: [f.id], placeId: place.id })
    const block = buildMemoryBlock(
      input({ npcs: [brom], facts: [f], places: [place], window: ['Where is Brom?'] }),
      BIG
    )!
    expect(block).toContain('Rusty Anchor')
    expect(block).toContain('Brom hides a key')
  })

  it('renders per-kind sections with status, stance and knowledge for selected NPCs', () => {
    const f = fact('The crown is cursed')
    const block = buildMemoryBlock(
      input({
        npcs: [
          npc('Mira', {
            stance: 'friendly',
            role: 'innkeeper',
            note: 'owes you',
            knowsFactIds: [f.id]
          })
        ],
        facts: [f]
      }),
      BIG
    )!
    expect(block).toContain('People:')
    expect(block).toContain('Mira (alive, friendly toward you), innkeeper')
    expect(block).toContain('owes you')
    expect(block).toContain('Knows: The crown is cursed')
  })

  it('puts dead, missing and departed NPCs on one gone line capped at the 10 most recent', () => {
    const gone = Array.from({ length: GONE_LINE_MAX + 2 }, (_, i) =>
      npc(`Ghost${i}`, { status: 'dead', updatedAt: i })
    )
    const block = buildMemoryBlock(input({ npcs: gone }), BIG)!
    const line = block.split('\n').find((l) => l.startsWith('Gone:'))!
    expect(line.match(/Ghost/g)).toHaveLength(GONE_LINE_MAX)
    expect(line).toContain('Ghost11 (dead)')
    expect(line).not.toContain('Ghost0 ')
    expect(line).not.toContain('Ghost1 ')
  })

  it('shows a mentioned dead NPC in full rather than on the gone line', () => {
    const block = buildMemoryBlock(
      input({ npcs: [npc('Old Tam', { status: 'dead' })], window: ['I think of Old Tam.'] }),
      BIG
    )!
    expect(block).toContain('Old Tam (dead)')
    expect(block).not.toContain('Gone:')
  })

  it('is deterministic: input order does not change the output; ties break by recency then name', () => {
    const a = npc('Alpha', { stance: 'allied', updatedAt: 5 })
    const b = npc('Beta', { stance: 'allied', updatedAt: 5 })
    const c = npc('Gamma', { stance: 'allied', updatedAt: 9 })
    const one = buildMemoryBlock(input({ npcs: [a, b, c] }), BIG)!
    const two = buildMemoryBlock(input({ npcs: [c, b, a] }), BIG)!
    expect(one).toBe(two)
    expect(one.indexOf('Gamma')).toBeLessThan(one.indexOf('Alpha'))
    expect(one.indexOf('Alpha')).toBeLessThan(one.indexOf('Beta'))
  })

  describe('overflow', () => {
    const records = () => {
      const core = npc('Corey', { stance: 'allied', description: 'x'.repeat(200) })
      const mention = npc('Mentia', { description: 'y'.repeat(200) })
      const wc = fact('World shift', { worldChanging: true, detail: 'z'.repeat(200) })
      const picked = Array.from({ length: 5 }, (_, i) =>
        fact(`Recent${i}`, { detail: 'r'.repeat(200), ...stamp({ session: 's9', changedSeq: 99 }) })
      )
      return input({ npcs: [core, mention], facts: [wc, ...picked], window: ['Mentia waves.'] })
    }
    const cost = (s: string | null) => (s ? estimateTokens(s) : 0)

    it('never exceeds the budget', () => {
      const full = buildMemoryBlock(records(), BIG)!
      for (const budget of [cost(full) - 1, 200, 120, 60]) {
        expect(cost(buildMemoryBlock(records(), budget))).toBeLessThanOrEqual(budget)
      }
    })

    it('drops whole selected records first before touching the core', () => {
      const full = buildMemoryBlock(records(), BIG)!
      const squeezed = buildMemoryBlock(records(), cost(full) - 100)!
      expect(squeezed).toContain('Corey')
      expect(squeezed).toContain('Mentia')
      expect(squeezed).toContain('World shift')
      expect(squeezed).toContain('x'.repeat(200))
      const kept = [0, 1, 2, 3, 4].filter((i) => squeezed.includes(`Recent${i}`))
      expect(kept.length).toBeLessThan(5)
      // Never mid-record: a kept record keeps its whole detail.
      for (const i of kept) expect(squeezed).toContain(`Recent${i}: ${'r'.repeat(200)}`)
    })

    it('degrades the lowest-ranked core entries to name-only lines when the core alone overflows', () => {
      const r = records()
      const coreOnly = { ...r, facts: r.facts.filter((f) => f.worldChanging) }
      const full = buildMemoryBlock(coreOnly, BIG)!
      const squeezed = buildMemoryBlock(coreOnly, cost(full) - 100)!
      // The world-changing fact is the lowest-ranked core group, so it degrades first.
      expect(squeezed).toContain('World shift')
      expect(squeezed).not.toContain('z'.repeat(200))
      expect(squeezed).toContain('x'.repeat(200))
    })

    it('is null when nothing fits', () => {
      expect(buildMemoryBlock(records(), 1)).toBeNull()
    })
  })
})
