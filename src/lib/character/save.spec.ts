import { describe, expect, it } from 'vitest'
import { emptyDraft, type CharacterDraft } from './draft.ts'
import { loadWizardRules } from '#lib/server/character/wizard-rules.ts'
import { draftToCharacterInput } from './save.ts'

const rules = loadWizardRules()

const complete = (over: Partial<CharacterDraft> = {}): CharacterDraft => ({
  ...emptyDraft(),
  name: ' Brannoch ',
  race: 'human',
  class: 'fighter',
  background: 'acolyte',
  alignment: 'lawful-good',
  abilityMethod: 'rolling',
  baseScores: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
  picks: { 'class/fighter/fightingStyle-0': ['fighter-fighting-style-defense'] },
  equipment: { 'class/fighter/equipment-0': { option: 0, wild: [] } },
  ...over
})

describe('draftToCharacterInput', () => {
  it('maps the wizard vocabulary to the service vocabulary', () => {
    const input = draftToCharacterInput(rules, complete({ backstory: 'Born under a bad sign' }))
    expect(input.abilityMethod).toBe('roll')
    expect(input.scores).toEqual({ str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 })
    expect(input).toMatchObject({
      name: ' Brannoch ',
      race: 'human',
      class: 'fighter',
      background: 'acolyte',
      alignment: 'lawful-good',
      backstory: 'Born under a bad sign',
      picks: { 'class/fighter/fightingStyle-0': ['fighter-fighting-style-defense'] }
    })
    expect(input.equipment?.length).toBeGreaterThan(0)
    expect(input.equipment?.every((r) => r.choiceKey.startsWith('class/fighter/'))).toBe(true)
  })

  it('keeps the other method slugs unchanged', () => {
    expect(
      draftToCharacterInput(rules, complete({ abilityMethod: 'point-buy' })).abilityMethod
    ).toBe('point-buy')
  })

  it('refuses an incomplete draft', () => {
    expect(() => draftToCharacterInput(rules, complete({ race: null }))).toThrow(/race/)
    expect(() => draftToCharacterInput(rules, complete({ abilityMethod: null }))).toThrow(
      /ability/i
    )
    expect(() =>
      draftToCharacterInput(
        rules,
        complete({ baseScores: { str: 15, dex: null, con: 13, int: 12, wis: 10, cha: 8 } })
      )
    ).toThrow(/dex/)
  })
})
