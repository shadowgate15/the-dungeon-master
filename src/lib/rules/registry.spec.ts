import { describe, expect, it } from 'vitest'
import {
  acBonus,
  bestUnarmoredAc,
  draconicResilienceHp,
  dwarvenToughnessHp,
  expertiseSkillBonus,
  fightingStyleDefenseAc,
  hpBonus,
  unarmoredDefenseAc,
  type AbilityMods
} from './registry.ts'

const mods = (over: Partial<AbilityMods> = {}): AbilityMods => ({
  str: 0,
  dex: 0,
  con: 0,
  int: 0,
  wis: 0,
  cha: 0,
  ...over
})
const bare = { armor: false, shield: false }
const shielded = { armor: false, shield: true }
const armored = { armor: true, shield: false }

describe('unarmoredDefenseAc', () => {
  it('Barbarian: 10 + DEX + CON, shield allowed', () => {
    const m = mods({ dex: 2, con: 3 })
    expect(unarmoredDefenseAc('barbarian-unarmored-defense', m, bare)).toBe(15)
    expect(unarmoredDefenseAc('barbarian-unarmored-defense', m, shielded)).toBe(15)
  })
  it('Monk: 10 + DEX + WIS, no armor and no shield', () => {
    const m = mods({ dex: 3, wis: 2 })
    expect(unarmoredDefenseAc('monk-unarmored-defense', m, bare)).toBe(15)
    expect(unarmoredDefenseAc('monk-unarmored-defense', m, shielded)).toBeNull()
  })
  it('Draconic Sorcerer: 13 + DEX, no armor', () => {
    expect(unarmoredDefenseAc('draconic-resilience', mods({ dex: -1 }), bare)).toBe(12)
  })
  it('does not apply while wearing armor, or to other features', () => {
    const m = mods({ dex: 2, con: 2 })
    expect(unarmoredDefenseAc('barbarian-unarmored-defense', m, armored)).toBeNull()
    expect(unarmoredDefenseAc('rage', m, bare)).toBeNull()
  })
})

describe('bestUnarmoredAc', () => {
  it('returns the best active formula with its source', () => {
    expect(
      bestUnarmoredAc(['monk-unarmored-defense', 'draconic-resilience'], mods({ dex: 3 }), bare)
    ).toEqual({ value: 16, source: 'draconic-resilience' })
  })
  it('is null with no registered formula', () => {
    expect(bestUnarmoredAc(['rage'], mods(), bare)).toBeNull()
  })
})

describe('hit point bonuses', () => {
  it('Dwarven Toughness is +1 per level', () => {
    expect(dwarvenToughnessHp(1)).toBe(1)
    expect(dwarvenToughnessHp(5)).toBe(5)
  })
  it('Draconic Resilience is +1 per level', () => {
    expect(draconicResilienceHp(1)).toBe(1)
  })
  it('hpBonus sums the active registered features', () => {
    expect(hpBonus(['dwarven-toughness'], 1)).toBe(1)
    expect(hpBonus(['dwarven-toughness', 'draconic-resilience', 'rage'], 1)).toBe(2)
    expect(hpBonus([], 1)).toBe(0)
  })
})

describe('Fighting Style: Defense', () => {
  it('is +1 AC only while wearing armor', () => {
    expect(fightingStyleDefenseAc(true)).toBe(1)
    expect(fightingStyleDefenseAc(false)).toBe(0)
  })
  it('acBonus applies it only when the style is active', () => {
    expect(acBonus(['fighter-fighting-style-defense'], armored)).toBe(1)
    expect(acBonus(['fighter-fighting-style-defense'], bare)).toBe(0)
    expect(acBonus(['fighter-fighting-style-archery'], armored)).toBe(0)
  })
})

describe('expertiseSkillBonus', () => {
  it('adds nothing without proficiency', () => {
    expect(expertiseSkillBonus({ proficiencyBonus: 2, proficient: false, expertise: false })).toBe(
      0
    )
  })
  it('adds the proficiency bonus once when proficient', () => {
    expect(expertiseSkillBonus({ proficiencyBonus: 2, proficient: true, expertise: false })).toBe(2)
  })
  it('doubles it with expertise', () => {
    expect(expertiseSkillBonus({ proficiencyBonus: 2, proficient: true, expertise: true })).toBe(4)
  })
  it('expertise on a non-proficient skill (a stale pick) gives nothing', () => {
    expect(expertiseSkillBonus({ proficiencyBonus: 2, proficient: false, expertise: true })).toBe(0)
  })
})
