import { describe, expect, it } from 'vitest'
import {
  acceptPatch,
  encodeAssignment,
  encodeRolls,
  formatCardValue,
  parseAssignment,
  parseRolls,
  parseFeaturePicks,
  parseEquipmentPicks,
  seedOf,
  STEP_FIELDS
} from './conversation.ts'
import { loadDataset } from '#lib/rules/test-dataset.ts'
import { emptyDraft, reconcile, type CharacterDraft } from './draft.ts'
import { staleCards } from './conversation.ts'

const STD = 'str=15, dex=14, con=13, int=12, wis=10, cha=8'
const unassigned = { str: null, dex: null, con: null, int: null, wis: null, cha: null }

describe('ability score card values', () => {
  it('round-trips an assignment and rejects malformed ones', () => {
    const scores = parseAssignment(STD)!
    expect(scores).toEqual({ str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 })
    expect(encodeAssignment(scores)).toBe(STD)
    expect(parseAssignment('str=15, str=14, con=13, int=12, wis=10, cha=8')).toBeNull()
    expect(parseAssignment('str=15')).toBeNull()
    expect(encodeAssignment(emptyDraft().baseScores)).toBe('')
  })

  it('round-trips rolled dice and shows each roll with its total', () => {
    const rolls = [
      [6, 5, 4, 1],
      [3, 3, 2, 1]
    ]
    expect(parseRolls(encodeRolls(rolls))).toEqual(rolls)
    expect(formatCardValue('abilityRolls', encodeRolls(rolls))).toBe(
      'Roll 1: 6 + 5 + 4 + 1 (drop lowest) = 15\nRoll 2: 3 + 3 + 2 + 1 (drop lowest) = 8'
    )
  })

  it('seeds the draft values as strings', () => {
    const draft = {
      ...emptyDraft(),
      abilityMethod: 'rolling' as const,
      abilityRolls: [[1, 2, 3, 4]]
    }
    expect(seedOf(draft)).toMatchObject({
      abilityMethod: 'rolling',
      abilityAssignment: '',
      abilityRolls: '1,2,3,4'
    })
  })
})

describe('acceptPatch', () => {
  it('records accepted dice and clears assignments while rolling, like the Roll button', () => {
    const draft = {
      ...emptyDraft(),
      abilityMethod: 'rolling' as const,
      baseScores: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 }
    }
    const patch = acceptPatch(draft, 'abilityRolls', '6,6,6,6;1,1,1,1')
    expect(patch.abilityRolls).toEqual([
      [6, 6, 6, 6],
      [1, 1, 1, 1]
    ])
    expect(patch.baseScores).toEqual(unassigned)
  })

  it('keeps assignments of another method when dice are accepted', () => {
    const draft = { ...emptyDraft(), abilityMethod: 'standard-array' as const }
    expect(acceptPatch(draft, 'abilityRolls', '6,6,6,6').baseScores).toBeUndefined()
  })

  it('accepting a method resets scores like choosing it in the step', () => {
    expect(acceptPatch(emptyDraft(), 'abilityMethod', 'point-buy')).toMatchObject({
      abilityMethod: 'point-buy',
      baseScores: { str: 8 }
    })
  })
})

describe('skills, equipment and spells card values', () => {
  it('proposes skills and features by choice key and merges them into the draft picks', () => {
    const value =
      'class/fighter/fightingStyle-0=fighter-fighting-style-defense; background/acolyte/skills=insight,religion'
    expect(parseFeaturePicks(value)).toEqual({
      'class/fighter/fightingStyle-0': ['fighter-fighting-style-defense'],
      'background/acolyte/skills': ['insight', 'religion']
    })
    expect(parseFeaturePicks('nonsense')).toBeNull()
    const draft = { ...emptyDraft(), picks: { 'race/elf/skill': ['perception'] } }
    expect(acceptPatch(draft, 'featurePicks', value).picks).toEqual({
      'race/elf/skill': ['perception'],
      'class/fighter/fightingStyle-0': ['fighter-fighting-style-defense'],
      'background/acolyte/skills': ['insight', 'religion']
    })
    expect(seedOf(draft).featurePicks).toBe('race/elf/skill=perception')
  })

  it('proposes equipment options and wildcard items per group', () => {
    const value = 'class/fighter/equipment-0=0:longsword,shield; class/fighter/equipment-1=1'
    expect(parseEquipmentPicks(value)).toEqual({
      'class/fighter/equipment-0': { option: 0, wild: ['longsword', 'shield'] },
      'class/fighter/equipment-1': { option: 1, wild: [] }
    })
    expect(parseEquipmentPicks('x=abc')).toBeNull()
    const patch = acceptPatch(emptyDraft(), 'equipmentPicks', value)
    expect(patch.equipment?.['class/fighter/equipment-1']).toEqual({ option: 1, wild: [] })
    const draft = { ...emptyDraft(), equipment: patch.equipment! }
    expect(seedOf(draft).equipmentPicks).toBe(value)
  })

  it('proposes the class spells as one list that replaces the picks', () => {
    const draft = { ...emptyDraft(), classSpells: ['light'] }
    expect(acceptPatch(draft, 'classSpells', 'mage-hand,magic-missile').classSpells).toEqual([
      'mage-hand',
      'magic-missile'
    ])
    expect(acceptPatch(draft, 'classSpells', '').classSpells).toEqual([])
    expect(seedOf(draft).classSpells).toBe('light')
  })

  it('makes steps 3 to 5 conversational', () => {
    expect(STEP_FIELDS.skills).toEqual(['featurePicks'])
    expect(STEP_FIELDS.equipment).toEqual(['equipmentPicks'])
    expect(STEP_FIELDS.spells).toEqual(['classSpells'])
  })
})

describe('pending cards invalidated by an earlier change', () => {
  const rules = loadDataset()
  const draftOf = (patch: Partial<CharacterDraft>) =>
    reconcile(rules, { ...emptyDraft(), race: 'human', background: 'acolyte', ...patch }).draft
  const card = (field: string, value: string) => ({ field, value })

  it('drops feature, equipment and spell cards whose target is gone after a class change', () => {
    const fighter = draftOf({ class: 'fighter' })
    const fighterKey = 'class/fighter/equipment-0'
    const cards = [
      card('featurePicks', 'class/fighter/fightingStyle-0=fighter-fighting-style-defense'),
      card('equipmentPicks', `${fighterKey}=0`),
      card('classSpells', 'light,sacred-flame')
    ]
    expect(staleCards(rules, fighter, cards)).toEqual([false, false, true])
    const wizard = draftOf({ class: 'wizard' })
    expect(staleCards(rules, wizard, cards)).toEqual([true, true, true])
  })

  it('keeps spell cards that still fit the class and drops those that no longer do', () => {
    const cleric = draftOf({ class: 'cleric' })
    expect(staleCards(rules, cleric, [card('classSpells', 'light,sacred-flame,bless')])).toEqual([
      false
    ])
    expect(staleCards(rules, draftOf({ class: 'wizard' }), [card('classSpells', 'bless')])).toEqual(
      [true]
    )
  })

  it('drops a subrace card when the race changes, unless a pending race card brings it back', () => {
    const sub = rules.subraces.find((s) => s.race === 'elf')!.slug
    expect(staleCards(rules, draftOf({ race: 'dwarf' }), [card('subrace', sub)])).toEqual([true])
    expect(staleCards(rules, draftOf({ race: 'elf' }), [card('subrace', sub)])).toEqual([false])
    expect(
      staleCards(rules, draftOf({ race: 'dwarf' }), [card('race', 'elf'), card('subrace', sub)])
    ).toEqual([false, false])
  })

  it('drops an ability arrangement when the method changed under it', () => {
    const arrangement = card('abilityAssignment', STD)
    const std = { ...emptyDraft(), abilityMethod: 'standard-array' as const }
    expect(staleCards(rules, std, [arrangement])).toEqual([false])
    expect(staleCards(rules, { ...std, abilityMethod: 'rolling' }, [arrangement])).toEqual([true])
  })

  it('drops a card whose value no longer parses', () => {
    expect(staleCards(rules, draftOf({ class: 'fighter' }), [card('classSpells', '')])).toEqual([
      true
    ])
  })
})
