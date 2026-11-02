import { GENRE_FLAVORS, MAGIC_LEVELS, SCALES, TECH_LEVELS } from './enums.ts'

export const SEED_FIELDS = [
  'name',
  'premise',
  'genreFlavor',
  'scale',
  'magicLevel',
  'techLevel'
] as const

export type SeedField = (typeof SEED_FIELDS)[number]

/** The seed card's live values. An empty string means unset. */
export type Seed = Record<SeedField, string>

export const FIELD_LABELS: Record<SeedField, string> = {
  name: 'Name',
  premise: 'Premise',
  genreFlavor: 'Genre flavor',
  scale: 'Scale',
  magicLevel: 'Magic level',
  techLevel: 'Tech level'
}

/** Allowed values for the enum-backed fields; undefined for free text. */
export const FIELD_OPTIONS: Partial<Record<SeedField, readonly string[]>> = {
  genreFlavor: GENRE_FLAVORS,
  scale: SCALES,
  magicLevel: MAGIC_LEVELS,
  techLevel: TECH_LEVELS
}

/** Upper bounds that keep a model reply from running away. */
export const NAME_MAX = 80
export const PREMISE_MAX = 600
export const REPLY_MAX = 400

export function emptySeed(): Seed {
  return { name: '', premise: '', genreFlavor: '', scale: '', magicLevel: '', techLevel: '' }
}
