import { describe, expect, it } from 'vitest'
import { assembleContext, estimateTokens, type ContextInput } from './context.ts'

const turn = (seq: number, author: 'dm' | 'player', text: string) => ({
  seq,
  author,
  kind: author === 'dm' ? ('narration' as const) : ('action' as const),
  text,
  rollRequest: null,
  rollResult: null
})

const input = (over: Partial<ContextInput> = {}): ContextInput => ({
  campaign: {
    name: 'The Sunken Crown',
    premise: 'Recover the crown.',
    tone: 'dark',
    length: 'short'
  },
  worlds: [
    { name: 'Eldoria', premise: 'A drowned kingdom.', genreFlavor: 'high-fantasy' },
    { name: 'Ashmark', premise: 'Plains of ash.', genreFlavor: null }
  ],
  sheet: 'Brenna, level 1 Human Fighter. HP 12.',
  turns: [],
  contextLimit: 4096,
  replyReserve: 512,
  ...over
})

describe('assembleContext', () => {
  it('puts the static DM block, the Campaign Seed, every World and the sheet in the system prompts', () => {
    const { systemPrompts } = assembleContext(input())
    const all = systemPrompts.join('\n')
    expect(all).toContain('Dungeon Master')
    expect(all).toContain('The Sunken Crown')
    expect(all).toContain('Recover the crown.')
    expect(all).toContain('Eldoria')
    expect(all).toContain('A drowned kingdom.')
    expect(all).toContain('Ashmark')
    expect(all).toContain('Brenna, level 1 Human Fighter. HP 12.')
  })

  it('asks the DM to open the scene when there are no Turns', () => {
    const { messages } = assembleContext(input())
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({ role: 'user' })
  })

  it('sends Turns as plain text, DM as assistant and the player as user, in order', () => {
    const { messages } = assembleContext(
      input({ turns: [turn(1, 'dm', 'A door.'), turn(2, 'player', 'I open it.')] })
    )
    expect(messages).toEqual([
      { role: 'assistant', content: 'A door.' },
      { role: 'user', content: 'I open it.' }
    ])
  })

  it('keeps only the newest Turns that fit the Turn budget', () => {
    const long = 'x'.repeat(900) // about 300 tokens each
    const turns = Array.from({ length: 20 }, (_, i) =>
      turn(i + 1, i % 2 === 0 ? 'dm' : 'player', `${i + 1}:${long}`)
    )
    const { messages, droppedTurns, turnBudget } = assembleContext(
      input({ turns, contextLimit: 3000, replyReserve: 500 })
    )
    const used = messages.reduce((n, m) => n + estimateTokens(m.content), 0)
    expect(used).toBeLessThanOrEqual(turnBudget)
    expect(droppedTurns).toBeGreaterThan(0)
    expect(messages.length + droppedTurns).toBe(20)
    // The newest Turn is always kept, and what is kept is a contiguous tail.
    expect(messages.at(-1)?.content.startsWith('20:')).toBe(true)
    expect(messages[0].content.startsWith(`${droppedTurns + 1}:`)).toBe(true)
  })

  it('always keeps the newest Turn even when it alone exceeds the budget', () => {
    const { messages } = assembleContext(
      input({
        turns: [turn(1, 'player', 'y'.repeat(20000))],
        contextLimit: 1000,
        replyReserve: 500
      })
    )
    expect(messages).toHaveLength(1)
  })
})

describe('assembleContext with World memory', () => {
  const stamp = {
    createdSessionId: 's1',
    changedSessionId: 's1',
    changedSeq: 1,
    updatedAt: 1,
    retiredAt: null
  }
  const memory = (over: Partial<NonNullable<ContextInput['memory']>> = {}) => ({
    npcs: [
      {
        id: 'n1',
        name: 'Mira',
        description: 'An innkeeper.',
        role: null,
        status: 'alive' as const,
        placeId: null,
        stance: 'friendly' as const,
        note: null,
        knowsFactIds: [],
        ...stamp
      }
    ],
    places: [],
    factions: [],
    events: [],
    facts: [],
    window: [],
    focus: { sessionId: 's1', seq: 5 },
    ...over
  })

  it('leaves the prompts byte-for-byte unchanged with no memory', () => {
    const base = assembleContext(input({ summary: 'Earlier.', turns: [turn(1, 'dm', 'Hi.')] }))
    const empty = assembleContext(
      input({
        summary: 'Earlier.',
        turns: [turn(1, 'dm', 'Hi.')],
        memory: memory({ npcs: [] })
      })
    )
    expect(empty).toEqual(base)
  })

  it('puts the memory block after the sheet and before the summary, and says memory wins', () => {
    const { systemPrompts } = assembleContext(input({ summary: 'Earlier.', memory: memory() }))
    const at = systemPrompts.findIndex((p) => p.includes('Mira'))
    expect(at).toBe(4)
    expect(systemPrompts[3]).toContain('Brenna')
    expect(systemPrompts[5]).toContain('Earlier.')
    expect(systemPrompts[at]).toMatch(/memory wins/i)
  })

  it('caps memory at a quarter of the remaining budget and gives Turns the rest', () => {
    const big = memory({
      facts: Array.from({ length: 60 }, (_, i) => ({
        id: `f${i}`,
        title: `Fact ${i}`,
        detail: 'd'.repeat(300),
        worldChanging: true,
        supersededById: null,
        ...stamp
      }))
    })
    const base = assembleContext(input({ contextLimit: 8000, replyReserve: 500 }))
    const withMemory = assembleContext(
      input({ contextLimit: 8000, replyReserve: 500, memory: big })
    )
    const block = withMemory.systemPrompts[4]
    const used = estimateTokens(block)
    expect(used).toBeLessThanOrEqual(Math.floor(base.turnBudget * 0.25))
    expect(withMemory.turnBudget).toBe(base.turnBudget - used)
  })
})
