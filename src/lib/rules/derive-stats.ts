import {
  acBonus,
  bestUnarmoredAc,
  hpBonus,
  weaponAttackBonus,
  weaponDamageBonus,
  ABILITY_KEYS,
  type AbilityKey
} from './registry.ts'
import type { ResolvedFeatures } from './resolver.ts'
import type { RulesDataset } from './schema.ts'

/**
 * Derived stats (#98, #105). One pure function turns the resolver's output, the level, the base
 * ability scores and plain Rules Data into every number the sheet shows. Code owns the numbers;
 * only the player's choices are stored. Each stat is `ok` with a value, or `pending` with what is
 * still missing, so the wizard's live stats strip can fill in as the draft grows and a saved
 * Character derives with nothing pending. Never throws on an incomplete or odd draft.
 * Pure: no database or server imports.
 *
 * AC is unarmored only (`unarmoredAc`): armor and shield AC wait for the later sheet effort.
 */

export { ABILITY_KEYS, type AbilityKey } from './registry.ts'

/** The Rules Data collections deriving stats reads. */
export type DeriveRules = Pick<
  RulesDataset,
  'classes' | 'classLevels' | 'skills' | 'equipment' | 'proficiencies'
>

export type Stat<T> = { status: 'ok'; value: T } | { status: 'pending'; missing: string[] }

/**
 * What a pending stat waits for: `race`, `subrace`, `class`, `subclass`, `background` (a missing
 * or inconsistent structural pick), `level`, `score:<ability>` (a base score not assigned yet) or
 * `choice:<choice key>` (a Feature choice group with fewer picks than it needs).
 */
export interface DeriveInput {
  /** The class slug, as in the resolver draft. */
  class: string | null
  level: number
  /** Base scores before racial bonuses; an unassigned score is absent or null. */
  baseScores: Partial<Record<AbilityKey, number | null>>
  /** Owned equipment item slugs (from the equipment picks). Every owned weapon gets an attack. */
  equipment?: readonly string[]
}

export interface AbilityStat {
  base: number
  racialBonus: number
  /** Base plus racial bonus, capped at 20. */
  score: number
  modifier: number
}
export interface SaveStat {
  modifier: number
  proficient: boolean
}
export interface SkillStat {
  ability: AbilityKey
  modifier: number
  proficient: boolean
  expertise: boolean
}
export interface UnarmoredAc {
  value: number
  /** `unarmored` or the registry feature slug that gave the best formula. */
  source: string
  /** Human-readable formula source, for the "unarmored AC" label. */
  formula: string
}
export interface SpellcastingStat {
  ability: AbilityKey
  saveDc: number
  attackBonus: number
  cantripsKnown: number | null
  /** Spells known (Bard, Sorcerer, Warlock); null for casters who prepare. */
  spellsKnown: number | null
  /** Cleric, Druid and Wizard: casting modifier + level, at least 1; null otherwise. */
  preparedCount: number | null
}
export interface WeaponAttack {
  /** Equipment slug. */
  weapon: string
  name: string
  ability: AbilityKey
  proficient: boolean
  attackBonus: number
  /** Null for weapons that deal no damage (the net). */
  damage: { dice: string; modifier: number; type: string } | null
}

export interface DerivedStats {
  abilities: Record<AbilityKey, Stat<AbilityStat>>
  proficiencyBonus: Stat<number>
  hitPoints: Stat<number>
  savingThrows: Record<AbilityKey, Stat<SaveStat>>
  /** Keyed by skill slug (`sleight-of-hand`). */
  skills: Record<string, Stat<SkillStat>>
  initiative: Stat<number>
  speed: Stat<number>
  passivePerception: Stat<number>
  unarmoredAc: Stat<UnarmoredAc>
  /** Slots by spell level 1 to 9; all zero for a non-caster. */
  spellSlots: Stat<number[]>
  /** `ok` with null when the class does not cast at this level. */
  spellcasting: Stat<SpellcastingStat | null>
  attacks: Stat<WeaponAttack[]>
}

// --- Helpers ------------------------------------------------------------------------------------

/** floor((score - 10) / 2): 8 and 9 are -1, 1 is -5. */
export const abilityModifier = (score: number) => Math.floor((score - 10) / 2)

export const MAX_ABILITY_SCORE = 20

/** A base score plus its racial bonus, never above 20. */
export const cappedScore = (base: number, racialBonus: number) =>
  Math.min(MAX_ABILITY_SCORE, base + racialBonus)

/** SRD p.56: +2 at levels 1 to 4, rising one every four levels. */
export const proficiencyBonusForLevel = (level: number) => 2 + Math.floor((level - 1) / 4)

/** Casting modifier + level, minimum 1 (Cleric, Druid, Wizard; #97). */
export const preparedSpellCount = (castingModifier: number, level: number) =>
  Math.max(1, castingModifier + level)

const PREPARING_CLASSES = ['cleric', 'druid', 'wizard']
const NO_SLOTS = [0, 0, 0, 0, 0, 0, 0, 0, 0]

/** Spell slots for a class at a level, from the class level table. */
export function spellSlotsFor(
  rules: Pick<RulesDataset, 'classLevels'>,
  classSlug: string,
  level: number
): number[] {
  const row = rules.classLevels.find((l) => l.class === classSlug && l.level === level)
  return row?.spellcasting ? [...row.spellcasting.slots] : [...NO_SLOTS]
}

const FORMULA_LABELS: Record<string, string> = {
  unarmored: '10 + DEX',
  'barbarian-unarmored-defense': 'Barbarian Unarmored Defense',
  'monk-unarmored-defense': 'Monk Unarmored Defense',
  'draconic-resilience': 'Draconic Resilience'
}

type Missing = string[]
const unique = (items: string[]) => [...new Set(items)]
const stat = <T>(missing: Missing, value: () => T): Stat<T> =>
  missing.length
    ? { status: 'pending', missing: unique(missing) }
    : { status: 'ok', value: value() }

// --- deriveStats --------------------------------------------------------------------------------

export function deriveStats(
  rules: DeriveRules,
  resolved: ResolvedFeatures,
  input: DeriveInput
): DerivedStats {
  const level = input.level
  const levelMissing: Missing =
    Number.isInteger(level) && level >= 1 && level <= 20 ? [] : ['level']
  const active = resolved.activeFeatureSlugs

  const structural = (...fields: string[]): Missing =>
    resolved.structure.filter((i) => fields.includes(i.field)).map((i) => i.field)
  const incompleteChoices = (...kinds: string[]): Missing =>
    resolved.groups
      .filter((g) => kinds.includes(g.kind) && g.status === 'incomplete')
      .map((g) => `choice:${g.key}`)

  // Abilities: base + racial bonus.
  const raceMissing: Missing = [
    ...structural('race', 'subrace'),
    ...incompleteChoices('abilityBonus')
  ]
  const abilityResults = Object.fromEntries(
    ABILITY_KEYS.map((key) => {
      const base = input.baseScores[key]
      const missing: Missing = [...raceMissing]
      if (typeof base !== 'number' || !Number.isFinite(base)) missing.push(`score:${key}`)
      return [
        key,
        stat(missing, (): AbilityStat => {
          const racialBonus = resolved.abilityBonusTotals[key] ?? 0
          const score = cappedScore(base as number, racialBonus)
          return { base: base as number, racialBonus, score, modifier: abilityModifier(score) }
        })
      ]
    })
  ) as Record<AbilityKey, Stat<AbilityStat>>

  const abilityMissing = (key: AbilityKey): Missing => {
    const s = abilityResults[key]
    return s.status === 'pending' ? s.missing : []
  }
  const mod = (key: AbilityKey) => {
    const s = abilityResults[key]
    return s.status === 'ok' ? s.value.modifier : 0
  }

  const proficiencyBonus = stat(levelMissing, () => proficiencyBonusForLevel(level))
  const pb = proficiencyBonusForLevel(level)

  // Proficiencies depend on every structural pick and on the skill and expertise choices.
  const proficiencyMissing: Missing = [
    ...structural('race', 'subrace', 'class', 'subclass', 'background'),
    ...incompleteChoices('skill', 'expertise')
  ]

  const hitPoints = stat(
    [
      ...levelMissing,
      ...structural('race', 'subrace', 'class', 'subclass'),
      ...abilityMissing('con'),
      ...(resolved.hitDie === null ? ['class'] : [])
    ],
    () => {
      const die = resolved.hitDie as number
      const perLevel = Math.floor(die / 2) + 1
      const total = die + (level - 1) * perLevel + level * mod('con') + hpBonus(active, level)
      return Math.max(1, total)
    }
  )

  const classMissing: Missing = [
    ...structural('class'),
    ...(resolved.savingThrows.length === 0 ? ['class'] : [])
  ]
  const savingThrows = Object.fromEntries(
    ABILITY_KEYS.map((key) => [
      key,
      stat([...classMissing, ...abilityMissing(key)], (): SaveStat => {
        const proficient = resolved.savingThrows.includes(key)
        return { modifier: mod(key) + (proficient ? pb : 0), proficient }
      })
    ])
  ) as Record<AbilityKey, Stat<SaveStat>>

  const skills: Record<string, Stat<SkillStat>> = {}
  for (const skill of rules.skills) {
    const ability = skill.ability as AbilityKey
    skills[skill.slug] = stat(
      [...levelMissing, ...proficiencyMissing, ...abilityMissing(ability)],
      (): SkillStat => {
        const entry = resolved.skills.find((s) => s.skill === skill.slug)
        const proficient = !!entry
        const expertise = !!entry?.expertise
        const bonus = !proficient ? 0 : expertise ? pb * 2 : pb
        return { ability, modifier: mod(ability) + bonus, proficient, expertise }
      }
    )
  }

  const initiative = stat(abilityMissing('dex'), () => mod('dex'))
  const speed = stat(resolved.speed === null ? ['race'] : [], () => resolved.speed as number)

  const perception = skills['perception']
  const passivePerception: Stat<number> =
    perception && perception.status === 'ok'
      ? { status: 'ok', value: 10 + perception.value.modifier }
      : { status: 'pending', missing: perception?.status === 'pending' ? perception.missing : [] }

  // AC: unarmored only. The best of 10 + DEX and any unarmored formula the Character has.
  const needsCon = active.includes('barbarian-unarmored-defense')
  const needsWis = active.includes('monk-unarmored-defense')
  const unarmoredAc = stat(
    [
      ...structural('class', 'subclass'),
      ...abilityMissing('dex'),
      ...(needsCon ? abilityMissing('con') : []),
      ...(needsWis ? abilityMissing('wis') : [])
    ],
    (): UnarmoredAc => {
      const mods = {
        str: mod('str'),
        dex: mod('dex'),
        con: mod('con'),
        int: mod('int'),
        wis: mod('wis'),
        cha: mod('cha')
      }
      const state = { armor: false, shield: false }
      let best: UnarmoredAc = { value: 10 + mods.dex, source: 'unarmored', formula: '10 + DEX' }
      const formula = bestUnarmoredAc(active, mods, state)
      if (formula && formula.value >= best.value) {
        best = {
          value: formula.value,
          source: formula.source,
          formula: FORMULA_LABELS[formula.source] ?? formula.source
        }
      }
      return { ...best, value: best.value + acBonus(active, state) }
    }
  )

  // Spellcasting.
  const cls = input.class ? rules.classes.find((c) => c.slug === input.class) : undefined
  const spellClassMissing: Missing = [...levelMissing, ...(cls ? [] : ['class'])]
  const spellSlots = stat(spellClassMissing, () => spellSlotsFor(rules, cls!.slug, level))
  const casting = cls?.spellcasting ?? null
  const casts = casting !== null && level >= casting.level
  const spellcasting = stat(
    [...spellClassMissing, ...(cls && casts ? abilityMissing(casting!.ability as AbilityKey) : [])],
    (): SpellcastingStat | null => {
      if (!cls || !casting || !casts) return null
      const ability = casting.ability as AbilityKey
      const row = rules.classLevels.find((l) => l.class === cls.slug && l.level === level)
      return {
        ability,
        saveDc: 8 + pb + mod(ability),
        attackBonus: pb + mod(ability),
        cantripsKnown: row?.spellcasting?.cantripsKnown ?? null,
        spellsKnown: row?.spellcasting?.spellsKnown ?? null,
        preparedCount: PREPARING_CLASSES.includes(cls.slug)
          ? preparedSpellCount(mod(ability), level)
          : null
      }
    }
  )

  // Per-weapon attacks for everything owned.
  const proficiencyBySlug = new Map(rules.proficiencies.map((p) => [p.slug, p]))
  const weaponProficiencies = resolved.proficiencies
    .filter((p) => p.type === 'Weapons')
    .map((p) => proficiencyBySlug.get(p.slug)?.reference)
  const isProficient = (weapon: DeriveRules['equipment'][number]) =>
    weaponProficiencies.some(
      (ref) =>
        ref &&
        ((ref.type === 'equipment' && ref.slug === weapon.slug) ||
          (ref.type === 'equipment-category' &&
            ref.slug === `${(weapon.weaponCategory ?? '').toLowerCase()}-weapons`))
    )
  const owned = [...new Set(input.equipment ?? [])]
  const attacks = stat(
    [
      ...levelMissing,
      ...proficiencyMissing,
      ...incompleteChoices('feature'),
      ...abilityMissing('str'),
      ...abilityMissing('dex')
    ],
    () =>
      owned.flatMap((slug): WeaponAttack[] => {
        const weapon = rules.equipment.find((e) => e.slug === slug)
        if (!weapon || !weapon.weaponCategory) return []
        const ranged = weapon.weaponRange === 'Ranged'
        const shape = { ranged, twoHanded: weapon.properties.includes('two-handed') }
        const finesse = weapon.properties.includes('finesse')
        const ability: AbilityKey = ranged
          ? 'dex'
          : finesse && mod('dex') > mod('str')
            ? 'dex'
            : 'str'
        const proficient = isProficient(weapon)
        return [
          {
            weapon: weapon.slug,
            name: weapon.name,
            ability,
            proficient,
            attackBonus: mod(ability) + (proficient ? pb : 0) + weaponAttackBonus(active, shape),
            damage: weapon.damage && {
              dice: weapon.damage.dice,
              modifier: mod(ability) + weaponDamageBonus(active, shape),
              type: weapon.damage.type
            }
          }
        ]
      })
  )

  return {
    abilities: abilityResults,
    proficiencyBonus,
    hitPoints,
    savingThrows,
    skills,
    initiative,
    speed,
    passivePerception,
    unarmoredAc,
    spellSlots,
    spellcasting,
    attacks
  }
}
