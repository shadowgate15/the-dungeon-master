import { beforeEach, describe, expect, it } from 'vitest'
import { migrateDatabase, openDatabase, type Database } from '../db/connect'
import { seedRulesData } from '../rules/seed'
import { createCharacterService, type CharacterInput } from './service'
import { saveCharacter } from './save'

let db: Database
beforeEach(() => {
  db = openDatabase(':memory:')
  migrateDatabase(db)
  seedRulesData(db)
})

const input: CharacterInput = {
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
}

describe('saveCharacter', () => {
  it('creates the Character and returns its id', () => {
    const service = createCharacterService(db)
    const result = saveCharacter(service, JSON.stringify(input))
    expect(result).toEqual({ id: expect.any(String) })
    expect(service.get((result as { id: string }).id)?.name).toBe('Brannoch')
  })

  it('reports a rule violation without creating anything', () => {
    const service = createCharacterService(db)
    const result = saveCharacter(service, JSON.stringify({ ...input, name: '  ' }))
    expect(result).toEqual({ error: 'Name is required' })
    expect(service.list()).toHaveLength(0)
  })

  it('reports an unreadable payload', () => {
    const service = createCharacterService(db)
    expect(saveCharacter(service, 'not json')).toEqual({
      error: 'The Character could not be read. Try saving again.'
    })
  })
})
