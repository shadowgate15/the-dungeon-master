import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { migrateDatabase, openDatabase } from '../db/connect'
import { runFieldRequest } from './field-flow.ts'
import { fieldRequestSchema, type FieldRequest } from './field-generation.ts'
import type { ChatPort, ChatRequest } from './port.ts'

/** A port that answers each call with the next whole object (not just `{ value }`). */
function fakePort(...objects: unknown[]) {
  const requests: ChatRequest[] = []
  const port: ChatPort = async function* (request) {
    requests.push(request)
    const object = objects[Math.min(requests.length, objects.length) - 1]
    yield { type: 'RUN_STARTED', threadId: 't', runId: 'r' }
    yield { type: 'CUSTOM', name: 'structured-output.complete', value: { object } }
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
    values: { ...blank, race: 'human', background: 'acolyte', ...values },
    ...over
  })

const system = (r: ChatRequest) => r.systemPrompts.join('\n')
const SKILLS = 'picks:class/fighter/proficiency-0'

describe('pick group requests', () => {
  it('accepts group field names and an optional draft of the group choices', () => {
    expect(request(SKILLS, { class: 'fighter' }).field).toBe(SKILLS)
    expect(() => request('picks')).toThrow()
    expect(() =>
      request(
        SKILLS,
        {},
        { choices: { picks: { x: 'not-a-list' }, equipment: {}, classSpells: [] } }
      )
    ).toThrow()
  })

  it('returns exactly the required number of legal picks', async () => {
    const { port, requests } = fakePort({ values: ['skill-athletics', 'skill-history'] })

    const result = await runFieldRequest(port, db, request(SKILLS, { class: 'fighter' }))

    expect(result).toEqual({ ok: true, value: ['skill-athletics', 'skill-history'] })
    const text = system(requests[0])
    expect(text).toMatch(/exactly 2/)
    expect(text).toContain('skill-athletics')
    // The output schema pins the count and unique items; it holds only legal slugs.
    const schema = z.toJSONSchema(requests[0].outputSchema) as unknown as {
      properties: { values: { minItems: number; maxItems: number; uniqueItems?: boolean } }
    }
    expect(schema.properties.values).toMatchObject({ minItems: 2, maxItems: 2, uniqueItems: true })
  })

  it.each([
    ['too few', ['skill-athletics']],
    ['a duplicate', ['skill-athletics', 'skill-athletics']],
    ['an illegal slug', ['skill-athletics', 'skill-arcana-not-real']],
    ['too many', ['skill-athletics', 'skill-history', 'skill-acrobatics']]
  ])('retries once on %s, then reports invalid-output', async (_name, values) => {
    const { port, requests } = fakePort({ values })

    const result = await runFieldRequest(port, db, request(SKILLS, { class: 'fighter' }))

    expect(result).toMatchObject({ ok: false, failure: { kind: 'invalid-output' } })
    expect(requests).toHaveLength(2)
    expect(system(requests[1]) + requests[1].messages[0].content).toMatch(/rejected/)
  })

  it('recovers when the retry is legal', async () => {
    const { port } = fakePort(
      { values: ['skill-athletics'] },
      { values: ['skill-athletics', 'skill-history'] }
    )
    const result = await runFieldRequest(port, db, request(SKILLS, { class: 'fighter' }))
    expect(result).toEqual({ ok: true, value: ['skill-athletics', 'skill-history'] })
  })

  it('rejects an answer identical to the current picks', async () => {
    const choices = {
      picks: { 'class/fighter/proficiency-0': ['skill-history', 'skill-athletics'] },
      equipment: {},
      classSpells: []
    }
    const { port, requests } = fakePort({ values: ['skill-athletics', 'skill-history'] })

    const result = await runFieldRequest(
      port,
      db,
      request(SKILLS, { class: 'fighter' }, { choices })
    )

    expect(result).toMatchObject({ ok: false, failure: { kind: 'invalid-output' } })
    expect(requests).toHaveLength(2)
  })

  it('shows the current picks by name when revising', async () => {
    const choices = {
      picks: { 'class/fighter/proficiency-0': ['skill-history', 'skill-athletics'] },
      equipment: {},
      classSpells: []
    }
    const { port, requests } = fakePort({ values: ['skill-acrobatics', 'skill-history'] })

    await runFieldRequest(
      port,
      db,
      request(
        SKILLS,
        { class: 'fighter' },
        { choices, mode: 'feedback', current: 'x', note: 'agile' }
      )
    )

    expect(system(requests[0])).toMatch(/Current value of .*History, Athletics|Athletics, History/)
  })

  it('has no options for a group the draft does not have', async () => {
    const { port, requests } = fakePort({ values: [] })
    const result = await runFieldRequest(port, db, request(SKILLS, { class: 'cleric' }))
    expect(result).toMatchObject({ ok: false, failure: { kind: 'no-options' } })
    expect(requests).toHaveLength(0)
  })

  it('has no options for the class spell list before a class is chosen', async () => {
    const { port, requests } = fakePort({ values: [] })
    const result = await runFieldRequest(port, db, request('classSpells:cantrips'))
    expect(result).toMatchObject({ ok: false, failure: { kind: 'no-options' } })
    expect(requests).toHaveLength(0)
  })

  it('generates the class cantrips from the class list only', async () => {
    const { port, requests } = fakePort({ values: ['fire-bolt', 'light', 'mage-hand'] })
    const result = await runFieldRequest(
      port,
      db,
      request('classSpells:cantrips', { class: 'wizard' })
    )
    expect(result).toEqual({ ok: true, value: ['fire-bolt', 'light', 'mage-hand'] })
    expect(system(requests[0])).toMatch(/exactly 3/)

    const bad = fakePort({ values: ['fire-bolt', 'light', 'sacred-flame'] })
    const rejected = await runFieldRequest(
      bad.port,
      db,
      request('classSpells:cantrips', { class: 'wizard' })
    )
    expect(rejected).toMatchObject({ ok: false, failure: { kind: 'invalid-output' } })
  })
})

describe('equipment group requests', () => {
  const FIELD = 'equipment:class/fighter/equipment-1'
  const fighter = { class: 'fighter' }

  it('returns a legal option with wild items from the matching category', async () => {
    const { port, requests } = fakePort({ option: 0, wild: ['longsword'] })

    const result = await runFieldRequest(port, db, request(FIELD, fighter))

    expect(result).toEqual({ ok: true, value: { option: 0, wild: ['longsword'] } })
    expect(system(requests[0])).toContain('longsword')
    const schema = z.toJSONSchema(requests[0].outputSchema) as unknown as {
      properties: { option: unknown; wild: { items: { enum: string[] } } }
    }
    expect(schema.properties.wild.items.enum).toContain('longsword')
    expect(schema.properties.wild.items.enum).not.toContain('club')
  })

  it.each([
    ['an illegal wild item', { option: 0, wild: ['club'] }],
    ['too few wild items for the option', { option: 1, wild: ['longsword'] }],
    ['wild items for an option with none', { option: 0, wild: [] }],
    ['an unknown option', { option: 5, wild: [] }]
  ])('rejects %s', async (_name, object) => {
    const { port, requests } = fakePort(object)
    const result = await runFieldRequest(port, db, request(FIELD, fighter))
    expect(result).toMatchObject({ ok: false, failure: { kind: 'invalid-output' } })
    expect(requests).toHaveLength(2)
  })

  it('accepts two wild items and an option without wildcards', async () => {
    const two = fakePort({ option: 1, wild: ['longsword', 'battleaxe'] })
    expect(await runFieldRequest(two.port, db, request(FIELD, fighter))).toEqual({
      ok: true,
      value: { option: 1, wild: ['longsword', 'battleaxe'] }
    })
    const none = fakePort({ option: 1, wild: [] })
    expect(
      await runFieldRequest(none.port, db, request('equipment:class/fighter/equipment-0', fighter))
    ).toEqual({ ok: true, value: { option: 1, wild: [] } })
  })

  it('never offers an option the Character lacks the proficiency for', async () => {
    const { port } = fakePort({ option: 1, wild: [] })
    // Cleric equipment-1: the third option (chain mail) needs proficiency the Cleric lacks.
    const result = await runFieldRequest(
      port,
      db,
      request('equipment:class/cleric/equipment-1', { class: 'cleric' })
    )
    expect(result).toEqual({ ok: true, value: { option: 1, wild: [] } })
    const denied = fakePort({ option: 2, wild: [] })
    const rejected = await runFieldRequest(
      denied.port,
      db,
      request('equipment:class/cleric/equipment-1', { class: 'cleric' })
    )
    expect(rejected).toMatchObject({ ok: false, failure: { kind: 'invalid-output' } })
  })

  it('has no options for a group of a class that is not chosen', async () => {
    const { port, requests } = fakePort({ option: 0, wild: [] })
    const result = await runFieldRequest(port, db, request(FIELD, { class: '' }))
    expect(result).toMatchObject({ ok: false, failure: { kind: 'no-options' } })
    expect(requests).toHaveLength(0)
  })
})
