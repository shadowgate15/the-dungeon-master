import { describe, expect, it } from 'vitest'
import { checkLabel, resultLabel } from './roll.ts'

describe('roll labels', () => {
  it('names an ability check and a skill check', () => {
    expect(checkLabel({ check: 'ability', key: 'str' })).toBe('Strength check')
    expect(checkLabel({ check: 'skill', key: 'sleight-of-hand' })).toBe('Sleight of Hand check')
    expect(checkLabel({ check: 'skill', key: 'stealth' })).toBe('Stealth check')
  })

  it('shows the d20, the signed modifier and the total', () => {
    expect(resultLabel({ d20: 15, modifier: 4, total: 19 })).toBe('15 + 4 = 19')
    expect(resultLabel({ d20: 3, modifier: -1, total: 2 })).toBe('3 - 1 = 2')
  })
})
