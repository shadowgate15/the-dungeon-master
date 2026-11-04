import { beforeAll, describe, expect, it } from 'vitest'
import { emptyDraft, reconcile, type CharacterDraft } from '#lib/character/draft.ts'
import { seedOf } from '#lib/character/conversation.ts'
import { loadDataset } from '#lib/rules/test-dataset.ts'
import { migrateDatabase, openDatabase } from '../db/connect'
import { createRulesRepository, type RulesRepository } from '../rules/repository'
import { seedRulesData } from '../rules/seed'
import { runCharacterTurn, type CharacterTurnInput } from './character-conversation.ts'
import type { ChatPort, ChatRequest } from './conversation-engine.ts'
import { characterTurnRequestSchema } from './request.ts'

const complete = (object: unknown) => [
  { type: 'RUN_STARTED', threadId: 't', runId: 'r' },
  { type: 'CUSTOM', name: 'structured-output.complete', value: { object } },
  { type: 'RUN_FINISHED', threadId: 't', runId: 'r' }
]

function fakePort(scripts: object[][]) {
  const requests: ChatRequest[] = []
  const port: ChatPort = async function* (request) {
    requests.push(request)
    for (const event of scripts[Math.min(requests.length, scripts.length) - 1]) yield event
  }
  return { port, requests }
}
const propose = (proposals: object) => complete({ reply: 'ok', proposals })

let rules: RulesRepository
beforeAll(() => {
  const db = openDatabase(':memory:')
  migrateDatabase(db)
  seedRulesData(db)
  rules = createRulesRepository(db)
})

const data = loadDataset()
const draftFor = (patch: Partial<CharacterDraft>): CharacterDraft =>
  reconcile(data, { ...emptyDraft(), race: 'human', background: 'acolyte', ...patch }).draft
const input = (step: CharacterTurnInput['step'], draft: CharacterDraft): CharacterTurnInput => ({
  step,
  draft,
  seed: seedOf(draft),
  history: [],
  dismissed: [],
  message: 'Help me'
})
const text = (r: ChatRequest) => r.systemPrompts.join('\n')
const run = (script: object[], step: CharacterTurnInput['step'], draft: CharacterDraft) => {
  const fake = fakePort([script])
  return { fake, result: runCharacterTurn(fake.port, rules, input(step, draft)) }
}

const STYLE = 'class/fighter/fightingStyle-0'
const SKILLS = 'class/fighter/proficiency-0'
const fighter = draftFor({ class: 'fighter' })

describe('Skills & features step', () => {
  it('lists the open choices by key and accepts a legal pick', async () => {
    const value = `${STYLE}=fighter-fighting-style-defense; ${SKILLS}=skill-athletics,skill-history`
    const { fake, result } = run(propose({ featurePicks: value }), 'skills', fighter)
    expect(await result).toMatchObject({ ok: true, proposals: { featurePicks: value } })
    expect(text(fake.requests[0])).toContain(STYLE)
    expect(text(fake.requests[0])).toContain('skill-acrobatics')
  })

  it.each([
    ['an unknown option slug', `${STYLE}=fighter-fighting-style-nonsense`],
    ['a choice key the character does not have', 'class/wizard/proficiency-0=skill-arcana'],
    ['too many picks for the group', `${SKILLS}=skill-athletics,skill-history,skill-insight`],
    ['too few picks for the group', `${SKILLS}=skill-athletics`],
    ['a repeated pick', `${SKILLS}=skill-athletics,skill-athletics`],
    ['a value that is not key=slug', 'defense']
  ])('retries %s and then fails as invalid output', async (_, featurePicks) => {
    const { fake, result } = run(propose({ featurePicks }), 'skills', fighter)
    expect(await result).toMatchObject({ ok: false, failure: { kind: 'invalid-output' } })
    expect(fake.requests).toHaveLength(3)
    expect(text(fake.requests[1])).toContain('rejected')
  })

  it('recovers when the retry is legal', async () => {
    const bad = propose({ featurePicks: `${SKILLS}=skill-athletics` })
    const good = propose({ featurePicks: `${SKILLS}=skill-athletics,skill-history` })
    const fake = fakePort([bad, good])
    const result = await runCharacterTurn(fake.port, rules, input('skills', fighter))
    expect(result).toMatchObject({ ok: true })
    expect(fake.requests).toHaveLength(2)
  })

  it('allows only the current step: other steps fields are stripped by the schema', async () => {
    const result = await runCharacterTurn(
      fakePort([propose({ classSpells: 'light' })]).port,
      rules,
      input('skills', fighter)
    )
    expect(result).toMatchObject({ ok: true, proposals: {} })
  })
})

describe('Equipment step', () => {
  const key = 'class/fighter/equipment-1'
  it('lists groups with options and wildcard items, and accepts a legal pick', async () => {
    const value = `class/fighter/equipment-0=0; ${key}=0:longsword`
    const { fake, result } = run(propose({ equipmentPicks: value }), 'equipment', fighter)
    expect(await result).toMatchObject({ ok: true, proposals: { equipmentPicks: value } })
    expect(text(fake.requests[0])).toContain(key)
    expect(text(fake.requests[0])).toContain('longsword')
  })

  it.each([
    ['an option that does not exist', `${key}=5`],
    ['a wildcard item outside the category', `${key}=0:dungeoneers-pack`],
    ['a missing wildcard item', `${key}=0`],
    ['the wrong number of wildcard items', `${key}=1:longsword`],
    ['a group the class does not own', 'class/wizard/equipment-0=0']
  ])('retries %s and then fails as invalid output', async (_, equipmentPicks) => {
    const { result } = run(propose({ equipmentPicks }), 'equipment', fighter)
    expect(await result).toMatchObject({ ok: false, failure: { kind: 'invalid-output' } })
  })

  it('rejects an option disabled for lack of proficiency and allows it once proficient', async () => {
    const group = data.classes
      .find((c) => c.slug === 'cleric')!
      .choiceGroups.find((g) =>
        g.options.some((o) =>
          o.items.some((i) => 'requiresProficiency' in i && i.requiresProficiency)
        )
      )!
    const index = group.options.findIndex((o) =>
      o.items.some((i) => 'requiresProficiency' in i && i.requiresProficiency)
    )
    const value = `class/cleric/${group.key}=${index}`
    const human = run(
      propose({ equipmentPicks: value }),
      'equipment',
      draftFor({ class: 'cleric' })
    )
    expect(await human.result).toMatchObject({ ok: false })
    expect(text(human.fake.requests[0])).toMatch(/Requires proficiency/)
    const dwarf = run(
      propose({ equipmentPicks: value }),
      'equipment',
      draftFor({ class: 'cleric', race: 'dwarf', subrace: 'hill-dwarf' })
    )
    expect(await dwarf.result).toMatchObject({ ok: true })
  })
})

describe('Spells step', () => {
  const list = (cls: string, level: 0 | 1) =>
    data.spells.filter((s) => s.level === level && s.classes.includes(cls)).map((s) => s.slug)
  const wizard = draftFor({ class: 'wizard' })
  const legal = [...list('wizard', 0).slice(0, 3), ...list('wizard', 1).slice(0, 6)].join(',')

  it('lists the class spell options and accepts exactly the allowed counts', async () => {
    const { fake, result } = run(propose({ classSpells: legal }), 'spells', wizard)
    expect(await result).toMatchObject({ ok: true, proposals: { classSpells: legal } })
    expect(text(fake.requests[0])).toContain(list('wizard', 0)[0])
    expect(text(fake.requests[0])).toMatch(/3 cantrips/)
  })

  it.each([
    ['too few spells', [...list('wizard', 0).slice(0, 3), ...list('wizard', 1).slice(0, 5)]],
    ['too many cantrips', [...list('wizard', 0).slice(0, 4), ...list('wizard', 1).slice(0, 6)]],
    [
      'a spell off the class list',
      [
        ...list('wizard', 0).slice(0, 3),
        ...list('cleric', 1)
          .filter((s) => !list('wizard', 1).includes(s))
          .slice(0, 6)
      ]
    ],
    ['an unknown spell', ['nonsense']],
    [
      'a repeated spell',
      [...list('wizard', 0).slice(0, 2), list('wizard', 0)[0], ...list('wizard', 1).slice(0, 6)]
    ]
  ])('retries %s and then fails as invalid output', async (_, slugs) => {
    const { fake, result } = run(propose({ classSpells: slugs.join(',') }), 'spells', wizard)
    expect(await result).toMatchObject({ ok: false, failure: { kind: 'invalid-output' } })
    expect(fake.requests).toHaveLength(3)
  })

  it('rejects spell picks for a class with no spells to pick', async () => {
    const { result } = run(propose({ classSpells: list('wizard', 0)[0] }), 'spells', fighter)
    expect(await result).toMatchObject({ ok: false })
  })
})

describe('request schema', () => {
  const body = (draft: object, step = 'skills') => ({
    step,
    draft,
    seed: seedOf(emptyDraft()),
    history: [],
    dismissed: [],
    message: 'hi'
  })
  it('keeps the picks, equipment and class spells the server reads', () => {
    const draft = {
      ...emptyDraft(),
      picks: { [STYLE]: ['fighter-fighting-style-defense'] },
      equipment: { 'class/fighter/equipment-0': { option: 0, wild: [] } },
      classSpells: ['light']
    }
    const parsed = characterTurnRequestSchema.safeParse(body(draft))
    expect(parsed.success).toBe(true)
    expect(parsed.data?.draft).toMatchObject({
      picks: draft.picks,
      equipment: draft.equipment,
      classSpells: ['light']
    })
  })

  it('bounds the new draft fields', () => {
    const tooMany = Array.from({ length: 100 }, (_, i) => `spell-${i}`)
    expect(
      characterTurnRequestSchema.safeParse(body({ ...emptyDraft(), classSpells: tooMany })).success
    ).toBe(false)
  })
})
