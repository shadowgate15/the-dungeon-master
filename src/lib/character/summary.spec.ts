import { beforeEach, describe, expect, it } from 'vitest'
import { migrateDatabase, openDatabase } from '#lib/server/db/connect.ts'
import { createCharacterService } from '#lib/server/character/service.ts'
import { loadWizardRules } from '#lib/server/character/wizard-rules.ts'
import { seedRulesData } from '#lib/server/rules/seed.ts'
import { emptyDraft } from './draft.ts'
import { buildSummary, detailToSummaryData, draftToSummaryData } from './summary.ts'

const rules = loadWizardRules()

function seeded() {
  const db = openDatabase(':memory:')
  migrateDatabase(db)
  seedRulesData(db)
  const service = createCharacterService(db)
  const created = service.create({
    name: 'Brannoch',
    race: 'human',
    class: 'fighter',
    background: 'acolyte',
    abilityMethod: 'standard-array',
    scores: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
    picks: {
      'class/fighter/proficiency-0': ['skill-athletics', 'skill-intimidation'],
      'class/fighter/fightingStyle-0': ['fighter-fighting-style-defense'],
      'race/human/language-0': ['dwarvish'],
      'background/acolyte/language-0': ['elvish', 'halfling']
    },
    equipment: [
      { choiceKey: 'class/fighter/equipment-0', item: 'chain-mail' },
      { choiceKey: 'class/fighter/equipment-1', item: 'longsword' },
      { choiceKey: 'class/fighter/equipment-1', item: 'shield' },
      { choiceKey: 'class/fighter/equipment-2', item: 'crossbow-light' },
      { choiceKey: 'class/fighter/equipment-2', item: 'crossbow-bolt', quantity: 20 },
      { choiceKey: 'class/fighter/equipment-3', item: 'dungeoneers-pack' }
    ]
  })
  return service.get(created.id)!
}

let model: ReturnType<typeof buildSummary>
beforeEach(() => {
  model = buildSummary(rules, detailToSummaryData(seeded()))
})

describe('buildSummary for a saved Character', () => {
  it('derives the numbers (human +1 to all, level 1 fighter)', () => {
    const { stats } = model
    expect(stats.abilities.str).toEqual({
      status: 'ok',
      value: { base: 15, racialBonus: 1, score: 16, modifier: 3 }
    })
    expect(stats.hitPoints).toEqual({ status: 'ok', value: 12 })
    expect(stats.unarmoredAc).toMatchObject({ status: 'ok', value: { value: 12 } })
    expect(stats.speed).toEqual({ status: 'ok', value: 30 })
    expect(stats.proficiencyBonus).toEqual({ status: 'ok', value: 2 })
  })

  it('names the picks and the owned equipment', () => {
    expect(model.names).toMatchObject({
      race: 'Human',
      class: 'Fighter',
      background: 'Acolyte',
      subrace: null
    })
    expect(model.equipment).toContainEqual({ name: 'Chain Mail', quantity: 1 })
    expect(model.equipment).toContainEqual({ name: 'Crossbow bolt', quantity: 20 })
  })

  it('gives every owned weapon an attack', () => {
    expect(model.stats.attacks).toMatchObject({ status: 'ok' })
    const attacks = model.stats.attacks.status === 'ok' ? model.stats.attacks.value : []
    expect(attacks.find((a) => a.weapon === 'longsword')).toMatchObject({
      attackBonus: 5,
      damage: { dice: '1d8', modifier: 3 }
    })
  })
})

describe('buildSummary for a draft', () => {
  it('leaves what is unknown pending instead of failing', () => {
    const { stats } = buildSummary(rules, draftToSummaryData(rules, emptyDraft()))
    expect(stats.hitPoints.status).toBe('pending')
  })
})
