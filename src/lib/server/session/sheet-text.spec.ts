import { describe, expect, it } from 'vitest'
import { buildSummary, detailToSummaryData } from '#lib/character/summary.ts'
import { migrateDatabase, openDatabase } from '../db/connect'
import { seedRulesData } from '../rules/seed'
import { createCharacterService } from '../character/service'
import { loadWizardRules } from '../character/wizard-rules.ts'
import { sheetText } from './sheet-text.ts'

describe('sheetText', () => {
  it('states the derived numbers of a saved Character', () => {
    const db = openDatabase(':memory:')
    migrateDatabase(db)
    seedRulesData(db)
    const characters = createCharacterService(db)
    const saved = characters.create({
      name: 'Brenna',
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
    })

    const text = sheetText(
      buildSummary(loadWizardRules(), detailToSummaryData(characters.get(saved.id)!))
    )

    expect(text).toContain('Brenna, level 1')
    expect(text).toContain('STR 16 (+3)') // 15 plus the human +1
    expect(text).toContain('Fighter')
  })
})
