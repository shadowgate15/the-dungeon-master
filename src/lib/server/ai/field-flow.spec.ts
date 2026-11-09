import { beforeEach, describe, expect, it } from 'vitest'
import { migrateDatabase, openDatabase, type Database } from '../db/connect'
import { createWorldService, type WorldService } from '../world/service'
import { runFieldRequest } from './field-flow.ts'
import { fieldRequestSchema, type FieldRequest } from './field-generation.ts'
import type { ChatPort, ChatRequest } from './port.ts'

function fakePort(value: unknown = 'Ember Road') {
  const requests: ChatRequest[] = []
  const port: ChatPort = async function* (request) {
    requests.push(request)
    yield { type: 'RUN_STARTED', threadId: 't', runId: 'r' }
    yield { type: 'CUSTOM', name: 'structured-output.complete', value: { object: { value } } }
    yield { type: 'RUN_FINISHED', threadId: 't', runId: 'r' }
  }
  return { port, requests }
}

let db: Database
let worlds: WorldService
beforeEach(() => {
  db = openDatabase(':memory:')
  migrateDatabase(db)
  worlds = createWorldService(db)
})

const makeWorld = (name: string, premise: string, scale: string | null = null) =>
  worlds.create({
    name,
    premise,
    genreFlavor: null,
    scale: scale as never,
    magicLevel: null,
    techLevel: null
  })

const request = (worldIds: string[], over: Record<string, unknown> = {}): FieldRequest =>
  fieldRequestSchema.parse({
    flow: 'campaign',
    field: 'name',
    mode: 'generate',
    worldIds,
    values: { name: '', premise: '', tone: '', length: '' },
    ...over
  })

const systemText = (r: ChatRequest) => r.systemPrompts.join('\n')

describe('campaign field requests', () => {
  it('puts each selected World seed in the prompt context', async () => {
    const a = makeWorld('Ashfall', 'A land of cinders and bells.', 'continent')
    const b = makeWorld('Bramble', 'A hedge-maze kingdom.')
    const { port, requests } = fakePort()

    const result = await runFieldRequest(port, db, request([a.id, b.id]))

    expect(result).toEqual({ ok: true, value: 'Ember Road' })
    const text = systemText(requests[0])
    expect(text).toContain('Ashfall')
    expect(text).toContain('A land of cinders and bells.')
    expect(text).toContain('continent')
    expect(text).toContain('Bramble')
    expect(text).toContain('A hedge-maze kingdom.')
  })

  it('also carries the Campaign fields the player already filled in', async () => {
    const a = makeWorld('Ashfall', 'Cinders.')
    const { port, requests } = fakePort('A tale.')

    await runFieldRequest(
      port,
      db,
      request([a.id], {
        field: 'premise',
        values: { name: 'Ember Road', premise: '', tone: 'tense', length: '' }
      })
    )

    expect(systemText(requests[0])).toContain('- Name: Ember Road')
    expect(systemText(requests[0])).toContain('- Tone: tense')
  })

  it('works with no World selected yet', async () => {
    const { port, requests } = fakePort()

    const result = await runFieldRequest(port, db, request([]))

    expect(result.ok).toBe(true)
    expect(systemText(requests[0])).toContain('none selected')
  })

  it('fails with context-invalid and no model call when a World is archived', async () => {
    const a = makeWorld('Ashfall', 'Cinders.')
    const b = makeWorld('Bramble', 'Hedges.')
    worlds.archive(b.id)
    const { port, requests } = fakePort()

    const result = await runFieldRequest(port, db, request([a.id, b.id]))

    expect(result).toMatchObject({ ok: false, failure: { kind: 'context-invalid' } })
    expect(requests).toHaveLength(0)
  })

  it('fails with context-invalid when a World is missing', async () => {
    const { port, requests } = fakePort()

    const result = await runFieldRequest(port, db, request(['nope']))

    expect(result).toMatchObject({ ok: false, failure: { kind: 'context-invalid' } })
    expect(requests).toHaveLength(0)
  })

  it('offers the tone options for the tone field', async () => {
    const a = makeWorld('Ashfall', 'Cinders.')
    const { port, requests } = fakePort('dark')

    const result = await runFieldRequest(port, db, request([a.id], { field: 'tone' }))

    expect(result).toEqual({ ok: true, value: 'dark' })
    expect(systemText(requests[0])).toContain('heroic, lighthearted, tense, dark')
  })
})

describe('world field requests', () => {
  it('need no database context', async () => {
    const { port } = fakePort('The Salt Coast')

    const result = await runFieldRequest(port, db, {
      flow: 'world',
      field: 'name',
      mode: 'generate',
      values: { name: '', premise: '', genreFlavor: '', scale: '', magicLevel: '', techLevel: '' }
    })

    expect(result).toEqual({ ok: true, value: 'The Salt Coast' })
  })
})
