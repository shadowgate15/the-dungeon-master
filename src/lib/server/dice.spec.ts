import { describe, expect, it } from 'vitest'
import { createDice } from './dice.ts'

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
