import { describe, expect, it } from 'vitest'
import { migrateDatabase, openDatabase } from '../db/connect'
import { runFieldRequest } from './field-flow.ts'
import { fieldRequestSchema, type FieldRequest } from './field-generation.ts'
import type { ChatPort, ChatRequest } from './port.ts'

function fakePort(...values: unknown[]) {
  const requests: ChatRequest[] = []
  const port: ChatPort = async function* (request) {
    requests.push(request)
    const value = values[Math.min(requests.length, values.length) - 1]
    yield { type: 'RUN_STARTED', threadId: 't', runId: 'r' }
    yield { type: 'CUSTOM', name: 'structured-output.complete', value: { object: { value } } }
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
