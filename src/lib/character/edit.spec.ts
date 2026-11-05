import { describe, expect, it } from 'vitest'
import { migrateDatabase, openDatabase } from '#lib/server/db/connect.ts'
import { createCharacterService, type CharacterInput } from '#lib/server/character/service.ts'
import { loadWizardRules } from '#lib/server/character/wizard-rules.ts'
import { seedRulesData } from '#lib/server/rules/seed.ts'
import { detailToDraft } from './edit.ts'
import { CharacterWizard } from './wizard.svelte.ts'

const rules = loadWizardRules()

function save(input: CharacterInput) {
  const db = openDatabase(':memory:')
  migrateDatabase(db)
  seedRulesData(db)
  const service = createCharacterService(db)
  return service.get(service.create(input).id)!
}

const fighter: CharacterInput = {
  name: 'Brannoch',
  alignment: 'lawful-good',
  backstory: 'Born under a bad sign',
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
    { choiceKey: 'class/fighter/equipment-3', item: 'dungeoneers-pack' },
    { choiceKey: 'background/acolyte/equipment-0', item: 'amulet' }
  ]
}

describe('detailToDraft', () => {
  it('reopens a saved Character with every step valid and nothing unsaved', () => {
    const wizard = new CharacterWizard(rules, undefined, detailToDraft(rules, save(fighter)))
    expect(wizard.steps.map((s) => [s.id, s.status])).toEqual([
      ['concept', 'valid'],
      ['abilities', 'valid'],
      ['skills', 'valid'],
      ['equipment', 'valid'],
      ['review', 'valid']
    ])
    expect(wizard.dirty).toBe(false)
    expect(wizard.draft).toMatchObject({
      name: 'Brannoch',
      alignment: 'lawful-good',
      backstory: 'Born under a bad sign',
      abilityMethod: 'standard-array'
    })
  })

  it('maps rolled scores back to the rolling method with their dice', () => {
    const dice = [
      [6, 5, 4, 1],
      [6, 6, 3, 2],
      [5, 5, 5, 1],
      [4, 4, 3, 3],
      [3, 3, 3, 2],
      [2, 2, 2, 1]
    ]
    const wizard = new CharacterWizard(
      rules,
      undefined,
      detailToDraft(
        rules,
        save({
          ...fighter,
          abilityMethod: 'roll',
          abilityRolls: dice,
          scores: { str: 15, dex: 15, con: 15, int: 11, wis: 9, cha: 6 }
        })
      )
    )
    expect(wizard.draft.abilityMethod).toBe('rolling')
    expect(wizard.draft.abilityRolls).toEqual(dice)
    expect(wizard.step('abilities')?.status).toBe('valid')
  })
})

describe('changing an earlier choice while editing', () => {
  const reopen = () => new CharacterWizard(rules, undefined, detailToDraft(rules, save(fighter)))

  it('keeps later picks that still have somewhere to attach and flags the conflict', () => {
    const w = reopen()
    // Elves know Elvish, which the Acolyte language pick already took.
    w.update({ race: 'elf', subrace: 'high-elf' })
    expect(w.draft.picks['background/acolyte/language-0']).toEqual(['elvish', 'halfling'])
    expect(w.step('skills')?.status).toBe('attention')
    expect(w.step('skills')?.issues.join(' ')).toMatch(/elvish.*already/i)
    expect(w.step('review')?.status).toBe('locked')
  })

  it('clears picks with nothing left to attach to and says so', () => {
    const w = reopen()
    w.update({ class: 'cleric' })
    expect(w.draft.picks['class/fighter/fightingStyle-0']).toBeUndefined()
    expect(w.draft.picks['class/fighter/proficiency-0']).toBeUndefined()
    expect(Object.keys(w.draft.equipment).filter((k) => k.startsWith('class/fighter'))).toEqual([])
    expect(w.notices).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Fighter choices'),
        expect.stringContaining('Fighter equipment choices')
      ])
    )
    // Unrelated picks survive.
    expect(w.draft.picks['race/human/language-0']).toEqual(['dwarvish'])
    expect(w.draft.picks['background/acolyte/language-0']).toEqual(['elvish', 'halfling'])
    expect(w.step('skills')?.status).toBe('incomplete')
  })

  it('clears race picks when the race changes, keeping the class picks', () => {
    const w = reopen()
    w.update({ race: 'dwarf', subrace: 'hill-dwarf' })
    expect(w.draft.picks['race/human/language-0']).toBeUndefined()
    expect(w.notices.join(' ')).toContain('Human choices')
    expect(w.draft.picks['class/fighter/fightingStyle-0']).toEqual([
      'fighter-fighting-style-defense'
    ])
  })

  it('clears background picks and equipment when the background changes', () => {
    const w = reopen()
    w.update({ background: 'custom', customBackgroundName: 'Smith', customBackgroundFeature: 'x' })
    expect(w.draft.picks['background/acolyte/language-0']).toBeUndefined()
    expect(w.draft.equipment['background/acolyte/equipment-0']).toBeUndefined()
    expect(w.notices.join(' ')).toContain('Acolyte')
  })

  it('does not dirty a wizard that was only opened', () => {
    expect(reopen().dirty).toBe(false)
  })
})
