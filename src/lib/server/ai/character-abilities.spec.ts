import { beforeAll, describe, expect, it } from 'vitest'
import { emptyDraft } from '#lib/character/draft.ts'
import { seedOf } from '#lib/character/conversation.ts'
import { migrateDatabase, openDatabase } from '../db/connect'
import { createRulesRepository, type RulesRepository } from '../rules/repository'
import { seedRulesData } from '../rules/seed'
import { runCharacterTurn, type CharacterTurnInput } from './character-conversation.ts'
import type { ChatPort, ChatRequest } from './conversation-engine.ts'

const complete = (object: unknown) => [
  { type: 'RUN_STARTED', threadId: 't', runId: 'r' },
  { type: 'CUSTOM', name: 'structured-output.complete', value: { object } },
  { type: 'RUN_FINISHED', threadId: 't', runId: 'r' }
]

/** Replays the n-th script per model call (last repeats); `onRequest` may run tools first. */
function fakePort(scripts: object[][], onRequest?: (r: ChatRequest, n: number) => void) {
  const requests: ChatRequest[] = []
  const port: ChatPort = async function* (request) {
    requests.push(request)
    onRequest?.(request, requests.length)
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

type Method = 'standard-array' | 'point-buy' | 'rolling'
const draftWith = (abilityMethod: Method | null, extra = {}) => ({
  ...emptyDraft(),
  abilityMethod,
  ...extra
})
const input = (over: Partial<CharacterTurnInput> = {}): CharacterTurnInput => ({
  step: 'abilities',
  draft: emptyDraft(),
  seed: seedOf(emptyDraft()),
  history: [],
  dismissed: [],
  message: 'Help me pick scores',
  ...over
})
const text = (r: ChatRequest) => r.systemPrompts.join('\n')
const STD = 'str=15, dex=14, con=13, int=12, wis=10, cha=8'
const propose = (proposals: object) => complete({ reply: 'ok', proposals })

describe('Ability scores step: assignment proposals', () => {
  it('proposes an arrangement of the standard array and lists the value set', async () => {
    const { port, requests } = fakePort([propose({ abilityAssignment: STD })])
    const result = await runCharacterTurn(
      port,
      rules,
      input({ draft: draftWith('standard-array') })
    )
    expect(result).toMatchObject({ ok: true, proposals: { abilityAssignment: STD } })
    expect(text(requests[0])).toContain('15, 14, 13, 12, 10, 8')
  })

  it('retries an arrangement with invented numbers, then fails as invalid output', async () => {
    const bad = propose({ abilityAssignment: 'str=18, dex=14, con=13, int=12, wis=10, cha=8' })
    const { port, requests } = fakePort([bad])
    const result = await runCharacterTurn(
      port,
      rules,
      input({ draft: draftWith('standard-array') })
    )
    expect(result).toMatchObject({ ok: false, failure: { kind: 'invalid-output' } })
    expect(requests).toHaveLength(3)
    expect(text(requests[1])).toContain('rejected')
  })

  it('accepts a point-buy arrangement within budget and rejects one over it', async () => {
    const draft = draftWith('point-buy')
    const good = await runCharacterTurn(
      fakePort([propose({ abilityAssignment: 'str=15, dex=14, con=13, int=8, wis=8, cha=8' })])
        .port,
      rules,
      input({ draft })
    )
    expect(good).toMatchObject({ ok: true })
    const over = await runCharacterTurn(
      fakePort([propose({ abilityAssignment: 'str=15, dex=15, con=15, int=15, wis=15, cha=15' })])
        .port,
      rules,
      input({ draft })
    )
    expect(over).toMatchObject({ ok: false })
  })

  it('never picks the method silently: an arrangement needs a method chosen or proposed', async () => {
    const without = await runCharacterTurn(
      fakePort([propose({ abilityAssignment: STD })]).port,
      rules,
      input()
    )
    expect(without).toMatchObject({ ok: false })
    const proposed = await runCharacterTurn(
      fakePort([propose({ abilityAssignment: STD, abilityMethod: 'standard-array' })]).port,
      rules,
      input()
    )
    expect(proposed).toMatchObject({
      ok: true,
      proposals: { abilityMethod: 'standard-array', abilityAssignment: STD }
    })
  })

  it('arranges the rolled set in the draft and rejects numbers outside it', async () => {
    // totals: 15, 9, 18, 4, 14, 12
    const abilityRolls = [
      [6, 5, 4, 1],
      [3, 3, 3, 3],
      [6, 6, 6, 6],
      [1, 1, 1, 2],
      [4, 4, 5, 5],
      [2, 3, 4, 5]
    ]
    const draft = draftWith('rolling', { abilityRolls })
    const ok = await runCharacterTurn(
      fakePort([propose({ abilityAssignment: 'str=18, dex=14, con=15, int=12, wis=9, cha=4' })])
        .port,
      rules,
      input({ draft })
    )
    expect(ok).toMatchObject({ ok: true })
    const invented = await runCharacterTurn(
      fakePort([propose({ abilityAssignment: STD })]).port,
      rules,
      input({ draft })
    )
    expect(invented).toMatchObject({ ok: false })
  })

  it('rejects an unknown method slug and a malformed arrangement', async () => {
    for (const proposals of [{ abilityMethod: 'fudging' }, { abilityAssignment: 'str=15' }]) {
      const r = await runCharacterTurn(
        fakePort([propose(proposals)]).port,
        rules,
        input({ draft: draftWith('standard-array') })
      )
      expect(r).toMatchObject({ ok: false })
    }
  })
})

describe('Ability scores step: roll_ability_scores tool', () => {
  const seq = (values: number[]) => {
    let i = 0
    return () => values[i++ % values.length]
  }
  // random 0.99 -> 6; 0 -> 1. Dice per roll: 6,6,6,6 => 24 dropped lowest = 18.
  const callTool = (r: ChatRequest) =>
    r.tools!.find((t) => t.name === 'roll_ability_scores')!.execute()

  it('offers the tool on the step, runs server code, and returns a Roll card first', async () => {
    const { port, requests } = fakePort([propose({})], (r) => {
      callTool(r)
      callTool(r) // a second call in the same turn returns the same roll
    })
    const result = await runCharacterTurn(port, rules, input({ draft: draftWith('rolling') }), {
      random: seq([0.99])
    })
    expect(requests[0].tools?.map((t) => t.name)).toEqual(['roll_ability_scores'])
    expect(result).toMatchObject({ ok: true })
    if (!result.ok) throw new Error()
    expect(Object.keys(result.proposals)[0]).toBe('abilityRolls')
    expect(result.proposals.abilityRolls).toBe(Array(6).fill('6,6,6,6').join(';'))
  })

  it('lets the reply arrange the fresh roll before it is accepted', async () => {
    const { port } = fakePort(
      [propose({ abilityAssignment: 'str=18, dex=18, con=18, int=18, wis=18, cha=18' })],
      (r) => callTool(r)
    )
    const result = await runCharacterTurn(port, rules, input({ draft: draftWith('rolling') }), {
      random: seq([0.99])
    })
    expect(result).toMatchObject({ ok: true })
  })

  it('does not offer the tool on other steps', async () => {
    const { port, requests } = fakePort([propose({})])
    await runCharacterTurn(port, rules, input({ step: 'concept' }))
    expect(requests[0].tools).toBeUndefined()
  })

  it('retries once without the tool when the provider rejects tools', async () => {
    const fail = [{ type: 'RUN_ERROR', message: 'tools are not supported', code: 'x' }]
    const { port, requests } = fakePort([fail, propose({ abilityMethod: 'rolling' })])
    const result = await runCharacterTurn(port, rules, input())
    expect(result).toMatchObject({ ok: true, proposals: { abilityMethod: 'rolling' } })
    expect(requests).toHaveLength(2)
    expect(requests[0].tools).toBeDefined()
    expect(requests[1].tools).toBeUndefined()
    expect(text(requests[1])).toContain('Roll button')
  })

  it('does not retry again when the toolless call fails too', async () => {
    const fail = [{ type: 'RUN_ERROR', message: 'down', code: 'x' }]
    const { port, requests } = fakePort([fail])
    const result = await runCharacterTurn(port, rules, input())
    expect(result).toMatchObject({ ok: false, failure: { kind: 'provider-error' } })
    expect(requests).toHaveLength(2)
  })
})
