/**
 * Code registry for the few features whose effect is arithmetic rather than text (#96). Everything
 * else in the SRD is narrative and is never evaluated. Each entry is a pure function keyed by the
 * feature or trait slug it implements; derived stats (#105) call them with the resolver's active
 * feature slugs. Pure: no database or server imports.
 */

export type AbilityKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'
export type AbilityMods = Record<AbilityKey, number>

/** What the Character wears. AC is unarmored-only for now, but the formulas already honour this. */
export interface ArmorState {
  armor: boolean
  shield: boolean
}

interface UnarmoredFormula {
  base: number
  abilities: AbilityKey[]
  shieldAllowed: boolean
}

/** Unarmored Defense x3: Barbarian, Monk and the Draconic Sorcerer (Draconic Resilience). */
const UNARMORED: Record<string, UnarmoredFormula> = {
  'barbarian-unarmored-defense': { base: 10, abilities: ['dex', 'con'], shieldAllowed: true },
  'monk-unarmored-defense': { base: 10, abilities: ['dex', 'wis'], shieldAllowed: false },
  'draconic-resilience': { base: 13, abilities: ['dex'], shieldAllowed: true }
}

/** AC from one unarmored formula, or null when it does not apply to this feature or loadout. */
export function unarmoredDefenseAc(
  featureSlug: string,
  mods: AbilityMods,
  state: ArmorState
): number | null {
  const formula = UNARMORED[featureSlug]
  if (!formula || state.armor || (state.shield && !formula.shieldAllowed)) return null
  return formula.base + formula.abilities.reduce((sum, a) => sum + mods[a], 0)
}

/** The best unarmored formula among the active features, with the feature that provided it. */
export function bestUnarmoredAc(
  activeSlugs: readonly string[],
  mods: AbilityMods,
  state: ArmorState
): { value: number; source: string } | null {
  let best: { value: number; source: string } | null = null
  for (const slug of activeSlugs) {
    const value = unarmoredDefenseAc(slug, mods, state)
    if (value !== null && (!best || value > best.value)) best = { value, source: slug }
  }
  return best
}

/** Hill Dwarf: +1 hit point maximum, and +1 per level. */
export const dwarvenToughnessHp = (level: number) => level

/** Draconic Bloodline Sorcerer: +1 hit point maximum, and +1 per level. */
export const draconicResilienceHp = (level: number) => level

const HP_BONUS: Record<string, (level: number) => number> = {
  'dwarven-toughness': dwarvenToughnessHp,
  'draconic-resilience': draconicResilienceHp
}

/** Flat hit point maximum bonus from every active registered feature. */
export function hpBonus(activeSlugs: readonly string[], level: number): number {
  return activeSlugs.reduce((sum, slug) => sum + (HP_BONUS[slug]?.(level) ?? 0), 0)
}

/** Fighting Style: Defense, +1 AC while wearing armor. */
export const fightingStyleDefenseAc = (armor: boolean) => (armor ? 1 : 0)

const AC_BONUS: Record<string, (state: ArmorState) => number> = {
  'fighter-fighting-style-defense': (state) => fightingStyleDefenseAc(state.armor)
}

/** Flat AC bonus from every active registered feature. */
export function acBonus(activeSlugs: readonly string[], state: ArmorState): number {
  return activeSlugs.reduce((sum, slug) => sum + (AC_BONUS[slug]?.(state) ?? 0), 0)
}

/**
 * What a skill adds on top of its ability modifier: nothing, the proficiency bonus, or double
 * with Expertise. Expertise on a skill the Character is not proficient in does nothing.
 */
export function expertiseSkillBonus(input: {
  proficiencyBonus: number
  proficient: boolean
  expertise: boolean
}): number {
  if (!input.proficient) return 0
  return input.expertise ? input.proficiencyBonus * 2 : input.proficiencyBonus
}

/** What a weapon looks like to the fighting style bonuses. */
export interface WeaponShape {
  ranged: boolean
  twoHanded: boolean
}

/** Fighting Style: Archery, +2 to attack rolls with ranged weapons. */
export function weaponAttackBonus(activeSlugs: readonly string[], weapon: WeaponShape): number {
  return weapon.ranged && activeSlugs.includes('fighter-fighting-style-archery') ? 2 : 0
}

/**
 * Fighting Style: Dueling, +2 damage with a melee weapon held in one hand. Whether the other hand
 * is free is not tracked (no off-hand logic), so any melee weapon that is not two-handed counts.
 */
export function weaponDamageBonus(activeSlugs: readonly string[], weapon: WeaponShape): number {
  return !weapon.ranged &&
    !weapon.twoHanded &&
    activeSlugs.includes('fighter-fighting-style-dueling')
    ? 2
    : 0
}
