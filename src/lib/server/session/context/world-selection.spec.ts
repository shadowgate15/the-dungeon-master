import { describe, expect, it } from 'vitest'
import { estimateTokens } from '../../ai/tokens.ts'
import {
  degradeWorldMemory,
  renderWorldMemory,
  selectWorldMemory,
  worldMemoryTokens,
  type WorldRecords
} from './world-selection.ts'

const npc = (id: string, name: string, extra: Partial<WorldRecords['npcs'][number]> = {}) => ({
  id,
  name,
  role: 'Local',
  description: `${name}, a person of the town.`,
  status: 'alive' as const,
  retired: false,
  recent: false,
  ...extra
})
const fact = (id: string, title: string, extra: Partial<WorldRecords['facts'][number]> = {}) => ({
  id,
  title,
  detail: `${title} is known across the town and talked about a great deal.`,
  worldChanging: false,
  recent: false,
  npcIds: [] as string[],
  ...extra
})

const records = (over: Partial<WorldRecords> = {}): WorldRecords => ({
  places: [],
  npcs: [],
  facts: [],
  ...over
})

const select = (r: WorldRecords, history = '', budget = 800, scene: string[] = []) =>
  selectWorldMemory({ records: r, sceneNpcIds: scene, history, budget })

describe('World memory selection: core', () => {
  it('always includes the Scene NPCs, world-changing facts and one gone line, even over budget', () => {
    const r = records({
      npcs: [
        npc('n1', 'Mira'),
        npc('n2', 'Old Tom', { status: 'dead' }),
        npc('n3', 'Vex', { retired: true })
      ],
      places: [{ id: 'p1', name: 'Lost Mill', description: 'x', retired: true, recent: false }],
      facts: [fact('f1', 'The bridge fell', { worldChanging: true })]
    })
    const text = renderWorldMemory(select(r, '', 1, ['n1']))
    expect(text).toContain('Mira (Local)')
    expect(text).toContain('The bridge fell')
    expect(text).toMatch(/Gone:.*Old Tom \(dead\).*Vex \(retired\).*Lost Mill \(retired\)/)
    expect(text.split('\n').filter((l) => l.startsWith('- Gone'))).toHaveLength(1)
  })
})

describe('World memory selection: scoring', () => {
  const r = records({
    npcs: [npc('a', 'Alder'), npc('b', 'Birch'), npc('c', 'Cedar')],
    facts: [
      fact('f1', 'Hidden vault', { npcIds: ['s'] }),
      fact('f2', 'Stale rumour'),
      fact('f3', 'Fresh rumour', { recent: true })
    ]
  })

  it('keeps the highest scores that fit the budget and drops the rest', () => {
    // Birch is named in history (score 4), the vault is linked to a Scene NPC (2), the fresh
    // rumour is recent (1); the stale rumour scores 0.
    const sel = select(r, 'The player asked about Birch.', 60, ['s'])
    const text = renderWorldMemory(sel)
    expect(text).toContain('Birch')
    expect(text).not.toContain('Stale rumour')
    expect(text).not.toContain('Cedar')
    expect(worldMemoryTokens(sel)).toBeLessThanOrEqual(60)
  })

  it('prefers a higher score when only one entry fits', () => {
    const sel = select(r, 'Birch', 30)
    const text = renderWorldMemory(sel)
    expect(text).toContain('Birch')
    expect(text).not.toContain('Alder')
  })

  it('uses a names-only entry before dropping one', () => {
    const big = records({ npcs: [npc('a', 'Alder', { description: 'x'.repeat(400) })] })
    const text = renderWorldMemory(select(big, 'Alder', 20))
    expect(text).toContain('Alder')
    expect(text).not.toContain('xxxx')
  })

  it('lists a Scene NPC once, as core', () => {
    const text = renderWorldMemory(select(r, 'Alder', 800, ['a']))
    expect(text.match(/Alder \(Local\)/g)).toHaveLength(1)
    expect(text).not.toMatch(/^- Alder$/m)
  })
})

describe('degrading World memory', () => {
  it('trims the lowest score first, names-only before dropping, and ends at the core', () => {
    const r = records({
      npcs: [npc('a', 'Alder'), npc('b', 'Birch')],
      facts: [fact('f1', 'Hidden vault')]
    })
    let sel = select(r, 'Alder Birch', 800)
    expect(renderWorldMemory(sel)).toContain('Hidden vault: Hidden vault is known')
    sel = degradeWorldMemory(sel)!
    // The unmentioned fact is the lowest score, so it goes names-only first.
    expect(renderWorldMemory(sel)).not.toContain('is known across')
    expect(renderWorldMemory(sel)).toContain('Hidden vault')
    expect(renderWorldMemory(sel)).toContain('Alder (Local)')
    for (let i = 0; i < 10; i++) {
      const next = degradeWorldMemory(sel)
      if (!next) break
      sel = next
    }
    expect(degradeWorldMemory(sel)).toBeNull()
    expect(estimateTokens(renderWorldMemory(sel))).toBeLessThan(10)
  })
})
