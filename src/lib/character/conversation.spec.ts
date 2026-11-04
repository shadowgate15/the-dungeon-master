import { describe, expect, it } from 'vitest'
import {
  acceptPatch,
  encodeAssignment,
  encodeRolls,
  formatCardValue,
  parseAssignment,
  parseRolls,
  seedOf
} from './conversation.ts'
import { emptyDraft } from './draft.ts'

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
