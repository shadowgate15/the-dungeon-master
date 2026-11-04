import { describe, expect, it } from 'vitest'
import {
  abilityModifier,
  cappedScore,
  deriveStats,
  preparedSpellCount,
  proficiencyBonusForLevel,
  spellSlotsFor,
  type AbilityKey,
  type DeriveInput,
  type DerivedStats,
  type Stat
} from './derive-stats.ts'
import { resolveFeatures, type ResolverDraft } from './resolver.ts'
import { loadDataset } from './test-dataset.ts'

const rules = loadDataset()

const ABILITIES: AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']

const emptyDraft = (over: Partial<ResolverDraft> = {}): ResolverDraft => ({
  race: null,
  subrace: null,
  class: null,
  subclass: null,
  background: 'acolyte',
  picks: {},
  ...over
})

/** Fills every incomplete choice group with its first legal options until the draft is valid. */
function complete(draft: ResolverDraft): ResolverDraft {
  const picks: Record<string, string[]> = { ...draft.picks }
  for (let i = 0; i < 60; i++) {
    const resolved = resolveFeatures(rules, { ...draft, picks })
    const group = resolved.groups.find((g) => g.status === 'incomplete')
    if (!group) break
    const have = new Set(picks[group.key] ?? [])
    const add = group.options
      .filter((o) => !o.disabled && !have.has(o.slug))
      .slice(0, group.choose - have.size)
      .map((o) => o.slug)
    picks[group.key] = [...have, ...add]
  }
  return { ...draft, picks }
}

const SUBCLASS: Record<string, string> = { cleric: 'life', sorcerer: 'draconic', warlock: 'fiend' }

function derive(
  draft: ResolverDraft,
  scores: Partial<Record<AbilityKey, number>>,
  extra: Partial<DeriveInput> = {}
): DerivedStats {
  const resolved = resolveFeatures(rules, draft)
  return deriveStats(rules, resolved, {
    class: draft.class,
    level: 1,
    baseScores: scores,
    ...extra
  })
}

const ok = <T>(s: Stat<T>): T => {
  expect(s).toMatchObject({ status: 'ok' })
  return (s as { status: 'ok'; value: T }).value
}

describe('helpers', () => {
  it.each([
    [1, -5],
    [3, -4],
    [7, -2],
    [8, -1],
    [9, -1],
    [10, 0],
    [11, 0],
    [12, 1],
    [15, 2],
    [16, 3],
    [20, 5]
  ])('ability modifier of %i is %i', (score, mod) => {
    expect(abilityModifier(score)).toBe(mod)
  })

  it('caps the final score at 20', () => {
    expect(cappedScore(15, 2)).toBe(17)
    expect(cappedScore(19, 2)).toBe(20)
    expect(cappedScore(20, 1)).toBe(20)
  })

  it.each([
    [1, 2],
    [4, 2],
    [5, 3],
    [8, 3],
    [9, 4],
    [13, 5],
    [17, 6],
    [20, 6]
  ])('proficiency bonus at level %i is +%i', (level, bonus) => {
    expect(proficiencyBonusForLevel(level)).toBe(bonus)
  })

  it('prepares casting modifier + level spells, never fewer than one', () => {
    expect(preparedSpellCount(3, 1)).toBe(4)
    expect(preparedSpellCount(0, 1)).toBe(1)
    expect(preparedSpellCount(-1, 1)).toBe(1)
    expect(preparedSpellCount(-4, 2)).toBe(1)
    expect(preparedSpellCount(2, 5)).toBe(7)
  })

  it('reads spell slots from the class level table', () => {
    expect(spellSlotsFor(rules, 'wizard', 1)).toEqual([2, 0, 0, 0, 0, 0, 0, 0, 0])
    expect(spellSlotsFor(rules, 'wizard', 3)).toEqual([4, 2, 0, 0, 0, 0, 0, 0, 0])
    expect(spellSlotsFor(rules, 'warlock', 1)).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 0])
    expect(spellSlotsFor(rules, 'fighter', 1)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0])
    expect(spellSlotsFor(rules, 'paladin', 1)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0])
    expect(spellSlotsFor(rules, 'paladin', 2)).toEqual([2, 0, 0, 0, 0, 0, 0, 0, 0])
  })
})

/**
 * One hand-computed Character per class: a Human (+1 to every score, speed 30, SRD p.4) with the
 * Acolyte background and the standard array assigned to suit the class. Expected values come from
 * the SRD class text, not from the module.
 */
interface Golden {
  cls: string
  /** Base scores, then the expected results. */
  base: Record<AbilityKey, number>
  mods: Record<AbilityKey, number>
  hp: number
  ac: { value: number; source: string }
  saves: Partial<Record<AbilityKey, number>>
  slots1: number
  spell: null | {
    ability: AbilityKey
    dc: number
    attack: number
    cantrips: number
    known: number | null
    prepared: number | null
  }
}

const GOLDEN: Golden[] = [
  {
    cls: 'barbarian',
    base: { str: 15, dex: 14, con: 13, int: 8, wis: 12, cha: 10 },
    mods: { str: 3, dex: 2, con: 2, int: -1, wis: 1, cha: 0 },
    hp: 14, // d12 12 + CON 2
    ac: { value: 14, source: 'barbarian-unarmored-defense' }, // 10 + DEX 2 + CON 2
    saves: { str: 5, con: 4, dex: 2, wis: 1 },
    slots1: 0,
    spell: null
  },
  {
    cls: 'bard',
    base: { cha: 15, dex: 14, con: 13, wis: 12, int: 10, str: 8 },
    mods: { cha: 3, dex: 2, con: 2, wis: 1, int: 0, str: -1 },
    hp: 10, // d8 8 + 2
    ac: { value: 12, source: 'unarmored' },
    saves: { dex: 4, cha: 5, str: -1 },
    slots1: 2,
    spell: { ability: 'cha', dc: 13, attack: 5, cantrips: 2, known: 4, prepared: null }
  },
  {
    cls: 'cleric',
    base: { wis: 15, con: 14, str: 13, dex: 12, cha: 10, int: 8 },
    mods: { wis: 3, con: 2, str: 2, dex: 1, cha: 0, int: -1 },
    hp: 10,
    ac: { value: 11, source: 'unarmored' },
    saves: { wis: 5, cha: 2, dex: 1 },
    slots1: 2,
    spell: { ability: 'wis', dc: 13, attack: 5, cantrips: 3, known: null, prepared: 4 }
  },
  {
    cls: 'druid',
    base: { wis: 15, con: 14, dex: 13, int: 12, cha: 10, str: 8 },
    mods: { wis: 3, con: 2, dex: 2, int: 1, cha: 0, str: -1 },
    hp: 10,
    ac: { value: 12, source: 'unarmored' },
    saves: { int: 3, wis: 5, con: 2 },
    slots1: 2,
    spell: { ability: 'wis', dc: 13, attack: 5, cantrips: 2, known: null, prepared: 4 }
  },
  {
    cls: 'fighter',
    base: { str: 15, con: 14, dex: 13, wis: 12, int: 10, cha: 8 },
    mods: { str: 3, con: 2, dex: 2, wis: 1, int: 0, cha: -1 },
    hp: 12, // d10 10 + 2
    ac: { value: 12, source: 'unarmored' },
    saves: { str: 5, con: 4, dex: 2 },
    slots1: 0,
    spell: null
  },
  {
    cls: 'monk',
    base: { dex: 15, wis: 14, con: 13, str: 12, int: 10, cha: 8 },
    mods: { dex: 3, wis: 2, con: 2, str: 1, int: 0, cha: -1 },
    hp: 10,
    ac: { value: 15, source: 'monk-unarmored-defense' }, // 10 + DEX 3 + WIS 2
    saves: { str: 3, dex: 5, wis: 2 },
    slots1: 0,
    spell: null
  },
  {
    cls: 'paladin',
    base: { str: 15, cha: 14, con: 13, wis: 12, dex: 10, int: 8 },
    mods: { str: 3, cha: 2, con: 2, wis: 1, dex: 0, int: -1 },
    hp: 12,
    ac: { value: 10, source: 'unarmored' },
    saves: { wis: 3, cha: 4, str: 3 },
    slots1: 0, // Paladins start casting at level 2
    spell: null
  },
  {
    cls: 'ranger',
    base: { dex: 15, wis: 14, con: 13, str: 12, int: 10, cha: 8 },
    mods: { dex: 3, wis: 2, con: 2, str: 1, int: 0, cha: -1 },
    hp: 12,
    ac: { value: 13, source: 'unarmored' },
    saves: { str: 3, dex: 5, wis: 2 },
    slots1: 0,
    spell: null
  },
  {
    cls: 'rogue',
    base: { dex: 15, con: 14, cha: 13, int: 12, wis: 10, str: 8 },
    mods: { dex: 3, con: 2, cha: 2, int: 1, wis: 0, str: -1 },
    hp: 10,
    ac: { value: 13, source: 'unarmored' },
    saves: { dex: 5, int: 3, wis: 0 },
    slots1: 0,
    spell: null
  },
  {
    cls: 'sorcerer',
    base: { cha: 15, con: 14, dex: 13, wis: 12, int: 10, str: 8 },
    mods: { cha: 3, con: 2, dex: 2, wis: 1, int: 0, str: -1 },
    hp: 9, // d6 6 + 2 + Draconic Resilience 1
    ac: { value: 15, source: 'draconic-resilience' }, // 13 + DEX 2
    saves: { con: 4, cha: 5, dex: 2 },
    slots1: 2,
    spell: { ability: 'cha', dc: 13, attack: 5, cantrips: 4, known: 2, prepared: null }
  },
  {
    cls: 'warlock',
    base: { cha: 15, con: 14, dex: 13, wis: 12, int: 10, str: 8 },
    mods: { cha: 3, con: 2, dex: 2, wis: 1, int: 0, str: -1 },
    hp: 10,
    ac: { value: 12, source: 'unarmored' },
    saves: { wis: 3, cha: 5, con: 2 },
    slots1: 1,
    spell: { ability: 'cha', dc: 13, attack: 5, cantrips: 2, known: 2, prepared: null }
  },
  {
    cls: 'wizard',
    base: { int: 15, con: 14, dex: 13, wis: 12, cha: 10, str: 8 },
    mods: { int: 3, con: 2, dex: 2, wis: 1, cha: 0, str: -1 },
    hp: 8, // d6 6 + 2
    ac: { value: 12, source: 'unarmored' },
    saves: { int: 5, wis: 3, dex: 2 },
    slots1: 2,
    spell: { ability: 'int', dc: 13, attack: 5, cantrips: 3, known: null, prepared: 4 }
  }
]

describe('golden Characters, one per class', () => {
  it('covers all twelve classes', () => {
    expect(GOLDEN.map((g) => g.cls).sort()).toEqual(rules.classes.map((c) => c.slug).sort())
  })

  it.each(GOLDEN)('$cls', (g) => {
    const draft = complete(
      emptyDraft({ race: 'human', class: g.cls, subclass: SUBCLASS[g.cls] ?? null })
    )
    const d = derive(draft, g.base)

    for (const a of ABILITIES) {
      const v = ok(d.abilities[a])
      expect(v.score).toBe(g.base[a] + 1)
      expect(v.racialBonus).toBe(1)
      expect(v.modifier).toBe(g.mods[a])
    }
    expect(ok(d.proficiencyBonus)).toBe(2)
    expect(ok(d.hitPoints)).toBe(g.hp)
    expect(ok(d.speed)).toBe(30)
    expect(ok(d.initiative)).toBe(g.mods.dex)
    const ac = ok(d.unarmoredAc)
    expect(ac.value).toBe(g.ac.value)
    expect(ac.source).toBe(g.ac.source)
    for (const [a, total] of Object.entries(g.saves)) {
      expect(ok(d.savingThrows[a as AbilityKey]).modifier).toBe(total)
    }
    expect(ok(d.spellSlots)[0]).toBe(g.slots1)
    const spell = ok(d.spellcasting)
    if (!g.spell) {
      expect(spell).toBeNull()
    } else {
      expect(spell).toMatchObject({
        ability: g.spell.ability,
        saveDc: g.spell.dc,
        attackBonus: g.spell.attack,
        cantripsKnown: g.spell.cantrips,
        spellsKnown: g.spell.known,
        preparedCount: g.spell.prepared
      })
    }
  })

  it('adds proficiency to proficient saves only', () => {
    const draft = complete(emptyDraft({ race: 'human', class: 'fighter' }))
    const d = derive(draft, GOLDEN[4].base)
    expect(ok(d.savingThrows.str)).toEqual({ modifier: 5, proficient: true })
    expect(ok(d.savingThrows.dex)).toEqual({ modifier: 2, proficient: false })
  })
})

describe('bespoke cases', () => {
  it('Dwarven Toughness: Hill Dwarf gets +1 HP on top of the +2 CON', () => {
    const draft = complete(emptyDraft({ race: 'dwarf', subrace: 'hill-dwarf', class: 'fighter' }))
    const d = derive(draft, { str: 15, con: 14, dex: 13, wis: 12, int: 10, cha: 8 })
    expect(ok(d.abilities.con)).toMatchObject({ score: 16, modifier: 3 }) // 14 + 2
    expect(ok(d.abilities.wis).score).toBe(13) // Hill Dwarf +1 WIS
    expect(ok(d.hitPoints)).toBe(14) // 10 + 3 + 1
    expect(ok(d.speed)).toBe(25)
  })

  it('a Dwarf without its subrace has pending HP', () => {
    const draft = complete(emptyDraft({ race: 'dwarf', class: 'fighter' }))
    const d = derive(draft, { str: 15, con: 14, dex: 13, wis: 12, int: 10, cha: 8 })
    expect(d.hitPoints).toEqual({ status: 'pending', missing: ['subrace'] })
  })

  it('Unarmored Defense: Barbarian uses 10 + DEX + CON', () => {
    const draft = complete(emptyDraft({ race: 'human', class: 'barbarian' }))
    const d = derive(draft, { str: 8, dex: 8, con: 15, int: 8, wis: 8, cha: 8 })
    // DEX 9 -> -1, CON 16 -> +3: 10 - 1 + 3.
    expect(ok(d.unarmoredAc)).toEqual({
      value: 12,
      source: 'barbarian-unarmored-defense',
      formula: 'Barbarian Unarmored Defense'
    })
  })

  it('Unarmored Defense: falls back to 10 + DEX when the class formula is worse', () => {
    const draft = complete(emptyDraft({ race: 'human', class: 'monk' }))
    const d = derive(draft, { str: 8, dex: 8, con: 8, int: 8, wis: 3, cha: 8 })
    // DEX 9 -> -1, WIS 4 -> -3: 10 - 1 - 3 = 6 beats nothing; 10 + DEX = 9 wins.
    expect(ok(d.unarmoredAc)).toEqual({ value: 9, source: 'unarmored', formula: '10 + DEX' })
  })

  it('High Elf: the missing wizard cantrip does not block anything numeric', () => {
    const draft = complete(emptyDraft({ race: 'elf', subrace: 'high-elf', class: 'wizard' }))
    const incomplete = {
      ...draft,
      picks: Object.fromEntries(Object.entries(draft.picks).filter(([k]) => !k.includes('cantrip')))
    }
    const d = derive(incomplete, { str: 8, dex: 13, con: 14, int: 15, wis: 12, cha: 10 })
    expect(ok(d.hitPoints)).toBe(8) // d6 6 + CON 14 -> +2
    expect(ok(d.abilities.int).score).toBe(16) // High Elf +1 INT
    expect(ok(d.abilities.dex).score).toBe(15) // Elf +2 DEX
  })

  it('caps the final score at 20 with the racial bonus', () => {
    const draft = complete(emptyDraft({ race: 'human', class: 'fighter' }))
    const d = derive(draft, { str: 20, dex: 19, con: 15, int: 8, wis: 8, cha: 8 })
    expect(ok(d.abilities.str)).toMatchObject({ score: 20, racialBonus: 1, modifier: 5 })
    expect(ok(d.abilities.dex).score).toBe(20)
  })

  it('negative CON never takes HP below 1', () => {
    const draft = complete(emptyDraft({ race: 'elf', subrace: 'high-elf', class: 'wizard' }))
    const d = derive(draft, { str: 8, dex: 8, con: 1, int: 8, wis: 8, cha: 8 }, { level: 5 })
    // d6 6 + 4 x 4 = 22, CON 1 -> -5 x 5 = -25: floored at 1.
    expect(ok(d.hitPoints)).toBe(1)
  })

  it('Expertise: Rogue doubles proficiency on chosen skills only', () => {
    const base = complete(emptyDraft({ race: 'human', class: 'rogue' }))
    const draft: ResolverDraft = {
      ...base,
      picks: {
        ...base.picks,
        'class/rogue/proficiency-0': [
          'skill-acrobatics',
          'skill-perception',
          'skill-stealth',
          'skill-sleight-of-hand'
        ],
        'class/rogue/expertise-0': ['skill-stealth', 'skill-insight']
      }
    }
    const d = derive(draft, { dex: 15, con: 14, cha: 13, int: 12, wis: 10, str: 8 })
    // DEX 16 -> +3; WIS 11 -> +0; proficiency +2.
    expect(ok(d.skills['stealth'])).toMatchObject({
      modifier: 7,
      proficient: true,
      expertise: true
    })
    expect(ok(d.skills['insight'])).toMatchObject({ modifier: 4, expertise: true }) // Acolyte
    expect(ok(d.skills['acrobatics'])).toMatchObject({ modifier: 5, expertise: false })
    expect(ok(d.skills['athletics'])).toMatchObject({ modifier: -1, proficient: false }) // STR 9
    expect(ok(d.passivePerception)).toBe(12) // 10 + WIS 0 + proficiency 2
  })
})

describe('per-weapon attacks', () => {
  const fighter = (style: string) => {
    const base = complete(emptyDraft({ race: 'human', class: 'fighter' }))
    return {
      ...base,
      picks: { ...base.picks, 'class/fighter/fightingStyle-0': [style] }
    }
  }
  const attacks = (d: DerivedStats) => ok(d.attacks)

  it('adds Archery +2 to ranged attack rolls only', () => {
    const d = derive(
      fighter('fighter-fighting-style-archery'),
      { str: 15, con: 14, dex: 13, wis: 12, int: 10, cha: 8 },
      { equipment: ['longbow', 'longsword'] }
    )
    // DEX 14 -> +2, STR 16 -> +3, proficiency +2.
    const bow = attacks(d).find((a) => a.weapon === 'longbow')!
    expect(bow).toMatchObject({ attackBonus: 6, proficient: true, ability: 'dex' })
    expect(bow.damage).toEqual({ dice: '1d8', modifier: 2, type: 'piercing' })
    const sword = attacks(d).find((a) => a.weapon === 'longsword')!
    expect(sword).toMatchObject({ attackBonus: 5, ability: 'str' })
    expect(sword.damage).toEqual({ dice: '1d8', modifier: 3, type: 'slashing' })
  })

  it('adds Dueling +2 damage to one-handed melee weapons only', () => {
    const d = derive(
      fighter('fighter-fighting-style-dueling'),
      { str: 15, con: 14, dex: 13, wis: 12, int: 10, cha: 8 },
      { equipment: ['longsword', 'greatsword', 'longbow'] }
    )
    expect(attacks(d).find((a) => a.weapon === 'longsword')!.damage!.modifier).toBe(5)
    expect(attacks(d).find((a) => a.weapon === 'greatsword')!.damage!.modifier).toBe(3)
    expect(attacks(d).find((a) => a.weapon === 'longbow')!.damage!.modifier).toBe(2)
  })

  it('uses the better of STR and DEX for finesse weapons', () => {
    const draft = complete(emptyDraft({ race: 'human', class: 'rogue' }))
    const d = derive(
      draft,
      { dex: 15, con: 14, cha: 13, int: 12, wis: 10, str: 8 },
      { equipment: ['rapier', 'dagger'] }
    )
    expect(attacks(d).find((a) => a.weapon === 'rapier')).toMatchObject({
      ability: 'dex',
      attackBonus: 5,
      damage: { dice: '1d8', modifier: 3, type: 'piercing' }
    })
  })

  it('leaves out proficiency for weapons the Character is not proficient with', () => {
    const draft = complete(emptyDraft({ race: 'human', class: 'wizard' }))
    const d = derive(
      draft,
      { int: 15, con: 14, dex: 13, wis: 12, cha: 10, str: 8 },
      { equipment: ['longsword', 'dagger', 'quarterstaff'] }
    )
    const sword = attacks(d).find((a) => a.weapon === 'longsword')!
    expect(sword).toMatchObject({ proficient: false, attackBonus: -1 }) // STR 9 -> -1
    expect(sword.damage!.modifier).toBe(-1)
    expect(attacks(d).find((a) => a.weapon === 'dagger')).toMatchObject({
      proficient: true,
      attackBonus: 4 // finesse DEX 14 -> +2, proficiency +2
    })
  })

  it('counts racial weapon training: High Elf with a longsword', () => {
    const draft = complete(emptyDraft({ race: 'elf', subrace: 'high-elf', class: 'wizard' }))
    const d = derive(
      draft,
      { int: 15, con: 14, dex: 13, wis: 12, cha: 10, str: 8 },
      { equipment: ['longsword'] }
    )
    expect(attacks(d)[0]).toMatchObject({ weapon: 'longsword', proficient: true, attackBonus: 1 })
  })

  it('lists one attack per owned weapon, skipping non-weapons and repeats', () => {
    const draft = complete(emptyDraft({ race: 'human', class: 'fighter' }))
    const d = derive(
      draft,
      { str: 15, con: 14, dex: 13, wis: 12, int: 10, cha: 8 },
      { equipment: ['handaxe', 'handaxe', 'chain-mail', 'backpack', 'dagger'] }
    )
    expect(attacks(d).map((a) => a.weapon)).toEqual(['handaxe', 'dagger'])
  })
})

describe('pending stats', () => {
  it('names what a bare draft is missing instead of throwing', () => {
    const d = derive(emptyDraft(), {})
    expect(d.hitPoints).toEqual({
      status: 'pending',
      missing: expect.arrayContaining(['class', 'race', 'score:con'])
    })
    expect(d.speed).toEqual({ status: 'pending', missing: ['race'] })
    expect(d.abilities.str).toEqual({
      status: 'pending',
      missing: expect.arrayContaining(['race', 'score:str'])
    })
    expect(d.spellSlots).toEqual({ status: 'pending', missing: ['class'] })
    expect(d.spellcasting).toEqual({ status: 'pending', missing: ['class'] })
    expect(ok(d.proficiencyBonus)).toBe(2)
  })

  it('fills in progressively as the draft grows', () => {
    const draft = emptyDraft({ race: 'human', class: 'fighter' })
    const d = derive(draft, { dex: 14 })
    expect(ok(d.speed)).toBe(30)
    expect(ok(d.initiative)).toBe(2) // 14 + human 1 = 15
  })

  it('treats a not-yet-assigned score as missing, per ability', () => {
    const draft = complete(emptyDraft({ race: 'human', class: 'wizard' }))
    const d = derive(draft, { dex: 14, con: 12, int: null as never })
    expect(ok(d.abilities.dex).score).toBe(15)
    expect(d.abilities.int).toMatchObject({ status: 'pending' })
    expect(d.spellcasting).toEqual({ status: 'pending', missing: ['score:int'] })
    expect(d.hitPoints).toMatchObject({ status: 'ok' })
  })

  it('waits for incomplete skill picks before reporting skills', () => {
    const draft = emptyDraft({ race: 'human', class: 'fighter' })
    const d = derive(draft, { str: 15, con: 14, dex: 13, wis: 12, int: 10, cha: 8 })
    expect(d.skills['athletics']).toMatchObject({
      status: 'pending',
      missing: expect.arrayContaining(['choice:class/fighter/proficiency-0'])
    })
  })

  it('reports an out-of-range level as pending, not thrown', () => {
    const draft = complete(emptyDraft({ race: 'human', class: 'fighter' }))
    const d = derive(draft, { str: 15 }, { level: 0 })
    expect(d.proficiencyBonus).toEqual({ status: 'pending', missing: ['level'] })
    expect(d.hitPoints).toMatchObject({
      status: 'pending',
      missing: expect.arrayContaining(['level'])
    })
  })
})

describe('sweep: every race x class', () => {
  const combos = rules.races.flatMap((race) => {
    const subraces = rules.subraces.filter((s) => s.race === race.slug)
    const options = subraces.length ? subraces.map((s) => s.slug) : [null]
    return options.flatMap((subrace) =>
      rules.classes.map((cls) => ({ race: race.slug, subrace, cls: cls.slug }))
    )
  })

  it('derives every stat for a complete draft with nothing pending', () => {
    expect(combos.length).toBeGreaterThanOrEqual(9 * 12)
    const weapons = rules.equipment.filter((e) => e.weaponCategory).map((e) => e.slug)
    const failures: string[] = []
    for (const c of combos) {
      const label = `${c.race}/${c.subrace}/${c.cls}`
      try {
        const draft = complete(
          emptyDraft({
            race: c.race,
            subrace: c.subrace,
            class: c.cls,
            subclass: SUBCLASS[c.cls] ?? null
          })
        )
        const resolved = resolveFeatures(rules, draft)
        if (!resolved.valid) failures.push(`${label}: draft not valid`)
        const d = derive(
          draft,
          { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
          { equipment: weapons }
        )
        const pending: string[] = []
        const visit = (name: string, s: Stat<unknown>) => {
          if (s.status === 'pending') pending.push(`${name} [${s.missing.join(',')}]`)
        }
        for (const [k, v] of Object.entries(d)) {
          if (k === 'level') continue
          if (v && typeof v === 'object' && 'status' in v) visit(k, v as Stat<unknown>)
          else for (const [k2, v2] of Object.entries(v as object)) visit(`${k}.${k2}`, v2)
        }
        if (pending.length) failures.push(`${label}: ${pending.join('; ')}`)
        expect(ok(d.attacks)).toHaveLength(weapons.length)
      } catch (e) {
        failures.push(`${label}: threw ${(e as Error).message}`)
      }
    }
    expect(failures).toEqual([])
  })
})
