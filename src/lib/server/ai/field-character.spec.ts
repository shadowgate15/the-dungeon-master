import { describe, expect, it } from 'vitest'
import { migrateDatabase, openDatabase } from '../db/connect'
import { runFieldRequest } from './field-flow.ts'
import { fieldRequestSchema, type FieldRequest } from './field-generation.ts'
import type { ChatPort, ChatRequest } from './port.ts'

/** An ability arrangement answer is already the whole `{ scores }` object. */
const isScores = (value: unknown) =>
  typeof value === 'object' && value !== null && 'scores' in value

function fakePort(...values: unknown[]) {
  const requests: ChatRequest[] = []
  const port: ChatPort = async function* (request) {
    requests.push(request)
    const value = values[Math.min(requests.length, values.length) - 1]
    yield { type: 'RUN_STARTED', threadId: 't', runId: 'r' }
    yield {
      type: 'CUSTOM',
      name: 'structured-output.complete',
      value: { object: isScores(value) ? value : { value } }
    }
    yield { type: 'RUN_FINISHED', threadId: 't', runId: 'r' }
  }
  return { port, requests }
}

const db = openDatabase(':memory:')
migrateDatabase(db)

const blank = {
  name: '',
  race: '',
  subrace: '',
  class: '',
  subclass: '',
  background: '',
  alignment: '',
  appearance: '',
  personality: '',
  ideal: '',
  bond: '',
  flaw: '',
  abilityMethod: '',
  abilityScores: '',
  backstory: '',
  customBackgroundName: '',
  customBackgroundFeature: ''
}

const request = (
  field: string,
  values: Record<string, string> = {},
  over: Record<string, unknown> = {}
): FieldRequest =>
  fieldRequestSchema.parse({
    flow: 'character',
    field,
    mode: 'generate',
    values: { ...blank, ...values },
    ...over
  })

const system = (r: ChatRequest) => r.systemPrompts.join('\n')

describe('character field requests', () => {
  it('generates a text field with the other fields, resolved to names, as context', async () => {
    const { port, requests } = fakePort('A scarred veteran with a limp.')

    const result = await runFieldRequest(
      port,
      db,
      request('appearance', { race: 'dwarf', class: 'cleric', name: 'Brenna' })
    )

    expect(result).toEqual({ ok: true, value: 'A scarred veteran with a limp.' })
    const text = system(requests[0])
    expect(text).toContain('- Name: Brenna')
    expect(text).toContain('- Race: Dwarf')
    expect(text).toContain('- Class: Cleric')
    expect(text).toContain('- Backstory: (unset)')
    expect(text).not.toContain('- Appearance:')
  })

  it('offers every race slug and rejects one outside the options', async () => {
    const ok = fakePort('dwarf')
    expect(await runFieldRequest(ok.port, db, request('race'))).toEqual({
      ok: true,
      value: 'dwarf'
    })
    expect(system(ok.requests[0])).toMatch(/Allowed values: .*dwarf.*elf.*human/)

    const bad = fakePort('space-wizard', 'space-wizard')
    const result = await runFieldRequest(bad.port, db, request('race'))
    expect(result).toMatchObject({ ok: false, failure: { kind: 'invalid-output' } })
    expect(bad.requests).toHaveLength(2)
  })

  it('limits subrace options to the chosen race', async () => {
    const { port, requests } = fakePort('high-elf')

    const result = await runFieldRequest(port, db, request('subrace', { race: 'elf' }))

    expect(result).toEqual({ ok: true, value: 'high-elf' })
    const allowed = /Allowed values: ([^\n]*)/.exec(system(requests[0]))![1]
    expect(allowed).toContain('high-elf')
    expect(allowed).not.toContain('hill-dwarf')
  })

  it('has no options for a subrace until a race with subraces is chosen', async () => {
    const { port, requests } = fakePort('high-elf')

    for (const race of ['', 'human']) {
      const result = await runFieldRequest(port, db, request('subrace', { race }))
      expect(result).toMatchObject({ ok: false, failure: { kind: 'no-options' } })
    }
    expect(requests).toHaveLength(0)
  })

  it('shows a flagged value as (unset) in the context', async () => {
    const { port, requests } = fakePort('Brenna')

    await runFieldRequest(
      port,
      db,
      request('name', { race: 'dwarf', subrace: 'high-elf', class: 'not-a-class' })
    )

    const text = system(requests[0])
    expect(text).toContain('- Race: Dwarf')
    expect(text).toContain('- Subrace: (unset)')
    expect(text).toContain('- Class: (unset)')
  })

  it('writes the custom background feature given its name, and only for a custom background', async () => {
    const { port, requests } = fakePort('You know every safe road.')

    await runFieldRequest(
      port,
      db,
      request('customBackgroundFeature', {
        background: 'custom',
        customBackgroundName: 'Road Warden'
      })
    )
    expect(system(requests[0])).toContain('- Background name: Road Warden')

    const other = fakePort('Brenna')
    await runFieldRequest(other.port, db, request('name', { background: 'acolyte' }))
    expect(system(other.requests[0])).not.toContain('Background name')
    expect(system(other.requests[0])).toContain('- Background: Acolyte')
  })

  it('shows the current slug as a name when revising', async () => {
    const { port, requests } = fakePort('elf')

    await runFieldRequest(
      port,
      db,
      request('race', {}, { mode: 'feedback', current: 'dwarf', note: 'something slimmer' })
    )

    expect(system(requests[0])).toContain('Current value of Race: Dwarf')
  })

  it('trims over-long text to the field limit at a sentence boundary', async () => {
    const long = `${'A short sentence. '.repeat(40)}trailing words with no end`
    const { port } = fakePort(long)

    const result = await runFieldRequest(port, db, request('flaw'))

    expect(result.ok && (result.value as string).length).toBeLessThanOrEqual(500)
    expect(result.ok && (result.value as string).endsWith('.')).toBe(true)
  })

  it('rejects a request for an unknown character field', () => {
    expect(() => request('level')).toThrow()
  })
})

describe('character ability fields', () => {
  const answer = (scores: Record<string, number>) => ({ scores })
  const std = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 }
  const arrange = (values: Record<string, string> = {}): FieldRequest =>
    request('abilityScores', { abilityMethod: 'standard-array', ...values })

  it('picks a method from the three', async () => {
    const { port, requests } = fakePort('point-buy')

    const result = await runFieldRequest(port, db, request('abilityMethod'))

    expect(result).toEqual({ ok: true, value: 'point-buy' })
    expect(system(requests[0])).toMatch(/Allowed values: standard-array, point-buy, rolling/)
  })

  it('arranges the standard array and returns the scores as JSON', async () => {
    const { port, requests } = fakePort(answer(std))

    const result = await runFieldRequest(port, db, arrange({ class: 'fighter' }))

    expect(result).toEqual({ ok: true, value: JSON.stringify(std) })
    const text = system(requests[0])
    expect(text).toContain('15, 14, 13, 12, 10, 8')
    expect(text).toContain('- Class: Fighter')
  })

  it('rejects an illegal arrangement, retries once, then fails', async () => {
    const bad = answer({ ...std, str: 18 })
    const { port, requests } = fakePort(bad, bad)

    const result = await runFieldRequest(port, db, arrange())

    expect(result).toMatchObject({ ok: false, failure: { kind: 'invalid-output' } })
    expect(requests).toHaveLength(2)
  })

  it('recovers when the retry is a legal arrangement', async () => {
    const { port } = fakePort(answer({ ...std, str: 18 }), answer(std))
    expect(await runFieldRequest(port, db, arrange())).toMatchObject({ ok: true })
  })

  it('arranges rolled totals; the model sees totals only', async () => {
    const picked = { str: 9, dex: 11, con: 12, int: 13, wis: 14, cha: 16 }
    const { port, requests } = fakePort(answer(picked))

    const result = await runFieldRequest(
      port,
      db,
      request(
        'abilityScores',
        { abilityMethod: 'rolling' },
        { rolledTotals: [16, 14, 13, 12, 11, 9] }
      )
    )

    expect(result).toEqual({ ok: true, value: JSON.stringify(picked) })
    expect(system(requests[0])).toContain('16, 14, 13, 12, 11, 9')
  })

  it('spends a legal point buy', async () => {
    const buy = { str: 15, dex: 14, con: 13, int: 8, wis: 8, cha: 8 }
    const { port } = fakePort(answer(buy))
    const result = await runFieldRequest(
      port,
      db,
      request('abilityScores', { abilityMethod: 'point-buy' })
    )
    expect(result).toEqual({ ok: true, value: JSON.stringify(buy) })
  })

  it('has no options until a method is chosen, or until a rolling set exists', async () => {
    const { port, requests } = fakePort(answer(std))
    expect(await runFieldRequest(port, db, request('abilityScores'))).toMatchObject({
      ok: false,
      failure: { kind: 'no-options' }
    })
    expect(
      await runFieldRequest(port, db, request('abilityScores', { abilityMethod: 'rolling' }))
    ).toMatchObject({ ok: false, failure: { kind: 'no-options' } })
    expect(requests).toHaveLength(0)
  })

  it('rejects an arrangement identical to the current one', async () => {
    const other = { ...std, str: 14, dex: 15 }
    const { port, requests } = fakePort(answer(std), answer(other))

    const result = await runFieldRequest(port, db, arrange({ abilityScores: JSON.stringify(std) }))

    expect(result).toEqual({ ok: true, value: JSON.stringify(other) })
    expect(requests).toHaveLength(2)
  })
})
