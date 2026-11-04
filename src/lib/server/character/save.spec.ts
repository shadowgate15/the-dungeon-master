import { beforeEach, describe, expect, it } from 'vitest'
import { migrateDatabase, openDatabase, type Database } from '../db/connect'
import { seedRulesData } from '../rules/seed'
import { createCharacterService, type CharacterInput } from './service'
import { saveCharacter, updateCharacter } from './save'
import { emptyDraft } from '#lib/character/draft.ts'
import { draftToCharacterInput } from '#lib/character/save.ts'
import { loadWizardRules } from './wizard-rules'

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

  describe('updateCharacter', () => {
    it('replaces the Character and keeps its id', () => {
      const service = createCharacterService(db)
      const { id } = service.create(input)
      const result = updateCharacter(service, id, JSON.stringify({ ...input, name: 'Renamed' }))
      expect(result).toEqual({ id })
      expect(service.get(id)?.name).toBe('Renamed')
    })

    it('reports a rule violation and leaves the Character unchanged', () => {
      const service = createCharacterService(db)
      const { id } = service.create(input)
      expect(updateCharacter(service, id, JSON.stringify({ ...input, name: ' ' }))).toEqual({
        error: 'Name is required'
      })
      expect(service.get(id)?.name).toBe('Brannoch')
    })

    it('reports an archived Character as not editable', () => {
      const service = createCharacterService(db)
      const { id } = service.create(input)
      service.archive(id)
      expect(updateCharacter(service, id, JSON.stringify(input))).toEqual({
        error: 'An archived Character cannot be edited'
      })
    })

    it('reports a missing Character', () => {
      const service = createCharacterService(db)
      expect(updateCharacter(service, 'nope', JSON.stringify(input))).toEqual({
        error: 'Character not found'
      })
    })
  })

  describe('from a wizard draft', () => {
    const rules = loadWizardRules()
    const draft = {
      ...emptyDraft(),
      name: 'Brannoch',
      race: 'human',
      class: 'fighter',
      baseScores: { str: 18, dex: 14, con: 13, int: 12, wis: 8, cha: 6 },
      equipment: Object.fromEntries(
        [0, 1, 2, 3].map((i) => [`class/fighter/equipment-${i}`, { option: 0, wild: [] }])
      )
    }

    it('saves a rolling Character with its dice', () => {
      const abilityRolls = [
        [6, 5, 3, 1],
        [6, 6, 6, 1],
        [4, 4, 4, 4],
        [3, 3, 2, 1],
        [5, 4, 4, 2],
        [2, 2, 2, 2]
      ]
      const service = createCharacterService(db)
      const mapped = draftToCharacterInput(rules, {
        ...draft,
        background: 'acolyte',
        abilityMethod: 'rolling',
        abilityRolls,
        picks: input.picks!
      })
      const result = saveCharacter(service, JSON.stringify(mapped))
      expect(result).toEqual({ id: expect.any(String) })
      const saved = service.get((result as { id: string }).id)!
      expect(saved.abilityMethod).toBe('roll')
      expect(saved.abilityRolls).toEqual(abilityRolls)
    })

    it('saves a Character with a custom background', () => {
      const service = createCharacterService(db)
      const mapped = draftToCharacterInput(rules, {
        ...draft,
        background: 'custom',
        customBackgroundName: 'Wanderer',
        customBackgroundFeature: 'You know the roads.',
        abilityMethod: 'standard-array',
        baseScores: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
        picks: {
          ...input.picks,
          'background/custom/skills-0': ['skill-arcana', 'skill-history'],
          'background/custom/toolsOrLanguages-0': ['thieves-tools', 'elvish']
        }
      })
      delete mapped.picks!['background/acolyte/language-0']
      const result = saveCharacter(service, JSON.stringify(mapped))
      expect(result).toEqual({ id: expect.any(String) })
      expect(service.get((result as { id: string }).id)).toMatchObject({
        customBackgroundName: 'Wanderer',
        customBackgroundFeature: 'You know the roads.'
      })
    })
  })
})
