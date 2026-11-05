import { describe, expect, it } from 'vitest'
import methods from '#lib/rules/data/abilityScoreMethods.json'
import {
  POINT_BUY,
  ROLL,
  STANDARD_ARRAY,
  availableValues,
  pointsSpent,
  rollAbilityScores,
  rollTotal,
  rollTotals,
  validateAbilityScores
} from './ability-scores.ts'

type Scores = Parameters<typeof pointsSpent>[0]
const scores = (a: number[]): Scores => ({
  str: a[0],
  dex: a[1],
  con: a[2],
  int: a[3],
  wis: a[4],
  cha: a[5]
})
const blank: Scores = { str: null, dex: null, con: null, int: null, wis: null, cha: null }
const state = (...args: Parameters<typeof validateAbilityScores>) =>
  validateAbilityScores(...args).state

describe('constants match the rules data', () => {
  it('agrees with abilityScoreMethods.json', () => {
    const cfg = (slug: string) =>
      methods.find((m) => m.slug === slug)!.config as unknown as Record<string, unknown>
    expect(cfg('standard-array').values).toEqual([...STANDARD_ARRAY])
    expect(cfg('point-buy')).toMatchObject({
      budget: POINT_BUY.budget,
      min: POINT_BUY.min,
      max: POINT_BUY.max,
      costs: POINT_BUY.costs
    })
    expect(cfg('roll')).toMatchObject(ROLL)
  })
})

describe('rolling', () => {
  it('rolls six sets of four d6 and records every die', () => {
    const rolls = rollAbilityScores()
    expect(rolls).toHaveLength(6)
    for (const dice of rolls) {
      expect(dice).toHaveLength(4)
      for (const d of dice) expect(d >= 1 && d <= 6 && Number.isInteger(d)).toBe(true)
    }
  })

  it('uses the supplied random source', () => {
    expect(rollAbilityScores(() => 0.999).every((r) => r.every((d) => d === 6))).toBe(true)
    expect(rollAbilityScores(() => 0).every((r) => r.every((d) => d === 1))).toBe(true)
  })

  it('drops the lowest die from the total', () => {
    expect(rollTotal([1, 6, 5, 4])).toBe(15)
    expect(rollTotal([3, 3, 3, 3])).toBe(9)
    expect(
      rollTotals([
        [1, 1, 1, 1],
        [6, 6, 6, 1]
      ])
    ).toEqual([3, 18])
  })
})

describe('validateAbilityScores', () => {
  it('needs a method first', () => {
    expect(state(null, blank, null)).toBe('incomplete')
  })

  it('standard array: valid only for a permutation of the array', () => {
    expect(state('standard-array', scores([15, 14, 13, 12, 10, 8]), null)).toBe('valid')
    expect(state('standard-array', scores([8, 10, 12, 13, 14, 15]), null)).toBe('valid')
    expect(state('standard-array', scores([15, 15, 13, 12, 10, 8]), null)).toBe('attention')
    expect(state('standard-array', { ...blank, str: 15 }, null)).toBe('incomplete')
  })

  it('point buy: 27 points, 8 to 15, leftovers allowed', () => {
    expect(pointsSpent(scores([15, 15, 15, 8, 8, 8]))).toBe(27)
    expect(state('point-buy', scores([15, 15, 15, 8, 8, 8]), null)).toBe('valid')
    expect(state('point-buy', scores([8, 8, 8, 8, 8, 8]), null)).toBe('valid')
    expect(state('point-buy', scores([15, 15, 15, 9, 8, 8]), null)).toBe('attention')
    expect(state('point-buy', scores([16, 8, 8, 8, 8, 8]), null)).toBe('attention')
    expect(state('point-buy', scores([7, 8, 8, 8, 8, 8]), null)).toBe('attention')
  })

  it('rolling: needs rolls, and scores must be the rolled totals', () => {
    // Totals: 18, 15, 12, 9, 6, 15.
    const rolls = [
      [6, 6, 6, 1],
      [5, 5, 5, 1],
      [4, 4, 4, 1],
      [3, 3, 3, 1],
      [2, 2, 2, 1],
      [6, 5, 4, 3]
    ]
    expect(state('rolling', blank, null)).toBe('incomplete')
    expect(state('rolling', blank, rolls)).toBe('incomplete')
    expect(state('rolling', scores([18, 15, 15, 12, 9, 6]), rolls)).toBe('valid')
    expect(state('rolling', scores([18, 18, 15, 12, 9, 6]), rolls)).toBe('attention')
    expect(state('rolling', scores([18, 15, 15, 12, 9, 6]), rolls.slice(1))).toBe('attention')
  })
})

describe('availableValues', () => {
  it('removes values taken by other abilities, honouring duplicates', () => {
    const pool = [15, 15, 12]
    expect(availableValues(pool, { ...blank, str: 15 }, 'dex')).toEqual([15, 12])
    expect(availableValues(pool, { ...blank, str: 15, dex: 15 }, 'con')).toEqual([12])
    expect(availableValues(pool, { ...blank, str: 15 }, 'str')).toEqual([15, 15, 12])
  })
})
