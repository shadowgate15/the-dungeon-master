import { describe, expect, it } from 'vitest'
import { createCampaignDice, createDice } from './dice.ts'

const rollTwenty = (seed?: number) => {
  const dice = createDice(seed)
  return Array.from({ length: 20 }, () => dice.d20())
}

describe('seeded dice', () => {
  it('rolls the same sequence for the same seed', () => {
    expect(rollTwenty(42)).toEqual(rollTwenty(42))
  })

  it('rolls different sequences for different seeds', () => {
    expect(rollTwenty(1)).not.toEqual(rollTwenty(2))
  })

  it('only rolls faces of the die', () => {
    const dice = createDice(7)

    const rolls = Array.from({ length: 500 }, () => dice.roll(6))

    expect(Math.min(...rolls)).toBe(1)
    expect(Math.max(...rolls)).toBe(6)
  })

  it('exposes a Math.random-shaped generator so existing roll helpers can be seeded', () => {
    const value = createDice(3).random()

    expect(value).toBeGreaterThanOrEqual(0)
    expect(value).toBeLessThan(1)
  })

  it('still rolls valid d20s when unseeded', () => {
    for (const roll of rollTwenty()) {
      expect(roll).toBeGreaterThanOrEqual(1)
      expect(roll).toBeLessThanOrEqual(20)
    }
  })
})

describe('dice expressions', () => {
  it('rolls NdM+K, reporting each die, the modifier and the total', () => {
    const dice = createDice(42)
    const faces = createDice(42)

    const result = dice.rollExpression('2d6+3')

    const expected = [faces.roll(6), faces.roll(6)]
    expect(result.dice).toEqual(expected)
    expect(result.modifier).toBe(3)
    expect(result.total).toBe(expected[0] + expected[1] + 3)
  })

  it('rolls a negative modifier and a bare NdM', () => {
    expect(createDice(1).rollExpression('1d20-1').modifier).toBe(-1)
    const four = createDice(1).rollExpression('4d6')
    expect(four.dice).toHaveLength(4)
    expect(four.modifier).toBe(0)
    expect(four.total).toBe(four.dice.reduce((a, b) => a + b, 0))
  })

  it('reads a single die without a count, ignoring case and spaces', () => {
    const result = createDice(1).rollExpression(' D8 + 2 ')
    expect(result.dice).toHaveLength(1)
    expect(result.modifier).toBe(2)
  })

  it.each(['', 'd', '2d', 'd0', '0d6', '2d6+', '2x6', '2d6+3+1', 'abc', '101d6', '1d1001'])(
    'rejects the invalid expression %j',
    (expr) => {
      expect(() => createDice(1).rollExpression(expr)).toThrow(/dice expression/i)
    }
  )
})

describe('advantage and disadvantage', () => {
  /** A roller whose d20s come up in the given order. */
  const loaded = (...faces: number[]) => {
    const queue = [...faces]
    return createDice({ random: () => ((queue.shift() ?? 1) - 1) / 20 })
  }

  it('rolls two d20s on advantage and keeps the higher, recording both and the reason', () => {
    const result = loaded(4, 17).rollD20({ mode: 'advantage', reason: 'the guard is asleep' })

    expect(result).toEqual({
      mode: 'advantage',
      reason: 'the guard is asleep',
      dice: [4, 17],
      kept: 17
    })
  })

  it('rolls two d20s on disadvantage and keeps the lower', () => {
    const result = loaded(4, 17).rollD20({ mode: 'disadvantage', reason: 'blinded' })

    expect(result).toEqual({ mode: 'disadvantage', reason: 'blinded', dice: [4, 17], kept: 4 })
  })

  it('rolls one d20 on a normal roll', () => {
    expect(loaded(9, 3).rollD20()).toEqual({ mode: 'normal', dice: [9], kept: 9 })
  })
})

describe('critical hits', () => {
  it('doubles the dice of a damage expression but adds the modifier once', () => {
    // Each face of a d6 from a source that returns (face - 1) / 6.
    const faces = [3, 5, 1, 6]
    const dice = createDice({ random: () => ((faces.shift() ?? 1) - 1) / 6 })

    const result = dice.rollExpression('2d6+3', { crit: true })

    expect(result.dice).toEqual([3, 5, 1, 6])
    expect(result.modifier).toBe(3)
    expect(result.total).toBe(18)
    expect(result.crit).toBe(true)
  })

  it('rolls normally when the hit is not a crit', () => {
    const result = createDice(5).rollExpression('2d6+3')

    expect(result.dice).toHaveLength(2)
    expect(result.crit).toBe(false)
  })
})

describe('per-Campaign dice', () => {
  const twenty = (dice: { d20(): number }) => Array.from({ length: 20 }, () => dice.d20())

  it('gives two rollers with the same seed and Campaign identical sequences', () => {
    expect(twenty(createCampaignDice(42).for('campaign-a'))).toEqual(
      twenty(createCampaignDice(42).for('campaign-a'))
    )
  })

  it('gives different Campaigns and different seeds different sequences', () => {
    const a = twenty(createCampaignDice(42).for('campaign-a'))

    expect(twenty(createCampaignDice(42).for('campaign-b'))).not.toEqual(a)
    expect(twenty(createCampaignDice(43).for('campaign-a'))).not.toEqual(a)
  })

  it('never lets one Campaign consume another Campaign’s rolls', () => {
    const alone = twenty(createCampaignDice(7).for('campaign-b'))
    const shared = createCampaignDice(7)

    twenty(shared.for('campaign-a'))
    shared.for('campaign-a').rollExpression('8d6')

    expect(twenty(shared.for('campaign-b'))).toEqual(alone)
  })

  it('keeps one roller per Campaign, so its sequence carries on', () => {
    const campaigns = createCampaignDice(7)
    const sequence = twenty(createCampaignDice(7).for('campaign-a'))

    const first = Array.from({ length: 10 }, () => campaigns.for('campaign-a').d20())
    const rest = Array.from({ length: 10 }, () => campaigns.for('campaign-a').d20())

    expect([...first, ...rest]).toEqual(sequence)
  })

  it('rolls valid dice for every Campaign when unseeded', () => {
    for (const roll of twenty(createCampaignDice().for('campaign-a'))) {
      expect(roll).toBeGreaterThanOrEqual(1)
      expect(roll).toBeLessThanOrEqual(20)
    }
  })
})
