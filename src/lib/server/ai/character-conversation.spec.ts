import { beforeAll, describe, expect, it } from 'vitest'
import { emptyDraft } from '#lib/character/draft.ts'
import { seedOf } from '#lib/character/conversation.ts'
import { migrateDatabase, openDatabase } from '../db/connect'
import { createRulesRepository, type RulesRepository } from '../rules/repository'
import { seedRulesData } from '../rules/seed'
import {
  compactCharacterConversation,
  runCharacterTurn,
  type CharacterTurnInput
} from './character-conversation.ts'
import type { ChatPort, ChatRequest } from './conversation-engine.ts'
import { characterTurnRequestSchema } from './request.ts'

const complete = (object: unknown) => [
  { type: 'RUN_STARTED', threadId: 't', runId: 'r' },
  { type: 'CUSTOM', name: 'structured-output.complete', value: { object } },
  { type: 'RUN_FINISHED', threadId: 't', runId: 'r' }
]

/** Replays the n-th script for each model call; the last one repeats. */
function fakePort(scripts: object[][]) {
  const requests: ChatRequest[] = []
  const port: ChatPort = async function* (request) {
    requests.push(request)
    for (const event of scripts[Math.min(requests.length, scripts.length) - 1]) yield event
  }
  return { port, requests }
}

let rules: RulesRepository
beforeAll(() => {
  const db = openDatabase(':memory:')
  migrateDatabase(db)
  seedRulesData(db)
  rules = createRulesRepository(db)
})

const input = (over: Partial<CharacterTurnInput> = {}): CharacterTurnInput => ({
  step: 'concept',
  draft: emptyDraft(),
  seed: seedOf(emptyDraft()),
  history: [],
  dismissed: [],
  message: 'A gruff dwarven cleric',
  ...over
})
const text = (r: ChatRequest) => r.systemPrompts.join('\n')

describe('runCharacterTurn on the Concept step', () => {
  it('returns slug and text proposals', async () => {
    const { port } = fakePort([
      complete({
        reply: 'How about this?',
        proposals: { race: 'dwarf', class: 'cleric', name: 'Brenna' }
      })
    ])
    const result = await runCharacterTurn(port, rules, input())
    expect(result).toMatchObject({
      ok: true,
      reply: 'How about this?',
      proposals: { race: 'dwarf', class: 'cleric', name: 'Brenna' }
    })
  })

  it('adds the draft summary and the Concept legal options to the prompt', async () => {
    const { port, requests } = fakePort([complete({ reply: 'ok', proposals: {} })])
    await runCharacterTurn(
      port,
      rules,
      input({ draft: { ...emptyDraft(), race: 'elf', name: 'Aelar' } })
    )
    const prompt = text(requests[0])
    expect(prompt).toContain('Name: Aelar')
    expect(prompt).toContain('Race: Elf [elf]')
    expect(prompt).toContain('- dwarf: Dwarf')
    expect(prompt).toContain('- cleric: Cleric')
    expect(prompt).toContain('- acolyte: Acolyte')
    expect(prompt).toContain('- lawful-good: Lawful Good')
  })

  it('allows only the Concept fields in the turn schema', async () => {
    const { port, requests } = fakePort([complete({ reply: 'ok', proposals: {} })])
    await runCharacterTurn(port, rules, input())
    const proposals = (
      requests[0].outputSchema as unknown as { shape: { proposals: { shape: object } } }
    ).shape.proposals.shape
    expect(Object.keys(proposals).sort()).toEqual(
      [
        'alignment',
        'appearance',
        'background',
        'backstory',
        'class',
        'name',
        'personality',
        'race',
        'subrace'
      ].sort()
    )
  })

  it('silently retries an unknown slug with a correction, never showing the bad attempt', async () => {
    const { port, requests } = fakePort([
      complete({ reply: 'bad', proposals: { race: 'space-wizard' } }),
      complete({ reply: 'good', proposals: { race: 'dwarf' } })
    ])
    const result = await runCharacterTurn(port, rules, input())
    expect(result).toMatchObject({ ok: true, reply: 'good', proposals: { race: 'dwarf' } })
    expect(requests).toHaveLength(2)
    expect(text(requests[1])).toContain('Race "space-wizard" is not a legal option')
    expect(text(requests[1])).toContain('- dwarf: Dwarf')
  })

  it('rejects a subrace that does not belong to the race', async () => {
    const { port, requests } = fakePort([
      complete({ reply: 'bad', proposals: { race: 'human', subrace: 'high-elf' } }),
      complete({ reply: 'good', proposals: { race: 'elf', subrace: 'high-elf' } })
    ])
    const result = await runCharacterTurn(port, rules, input())
    expect(result).toMatchObject({ ok: true, proposals: { race: 'elf', subrace: 'high-elf' } })
    expect(text(requests[1])).toContain('does not belong to the race "human"')
  })

  it('fails with invalid-output after 2 retries (3 calls), then stops', async () => {
    const { port, requests } = fakePort([complete({ reply: 'bad', proposals: { class: 'nope' } })])
    const result = await runCharacterTurn(port, rules, input())
    expect(result).toMatchObject({ ok: false, failure: { kind: 'invalid-output' } })
    expect(requests).toHaveLength(3)
  })

  it('fails with options-changed before any model call when a draft slug is gone', async () => {
    const { port, requests } = fakePort([complete({ reply: 'ok', proposals: {} })])
    const result = await runCharacterTurn(
      port,
      rules,
      input({ draft: { ...emptyDraft(), race: 'removed-race' } })
    )
    expect(result).toMatchObject({ ok: false, failure: { kind: 'options-changed' } })
    expect(requests).toHaveLength(0)
  })

  it('carries provider failures through unretried', async () => {
    const { port, requests } = fakePort([
      [{ type: 'RUN_ERROR', message: 'boom', code: 'provider' }]
    ])
    const result = await runCharacterTurn(port, rules, input())
    expect(result).toMatchObject({ ok: false, failure: { kind: 'provider-error' } })
    expect(requests).toHaveLength(1)
  })

  it('compacts through the shared engine', async () => {
    const { port } = fakePort([complete({ summary: 'They want a gruff cleric.' })])
    const history = Array.from({ length: 10 }, (_, i) => ({
      role: i % 2 ? ('assistant' as const) : ('user' as const),
      content: `m${i}`
    }))
    const result = await compactCharacterConversation(port, input({ history, message: '' }))
    expect(result).toMatchObject({ ok: true, summary: 'They want a gruff cleric.' })
  })
})

describe('characterTurnRequestSchema', () => {
  const body = {
    step: 'concept',
    draft: emptyDraft(),
    seed: seedOf(emptyDraft()),
    history: [],
    dismissed: [],
    message: 'hi'
  }
  it('accepts a Concept turn and rejects an unsupported step', () => {
    expect(characterTurnRequestSchema.safeParse(body).success).toBe(true)
    expect(characterTurnRequestSchema.safeParse({ ...body, step: 'review' }).success).toBe(false)
  })
})
