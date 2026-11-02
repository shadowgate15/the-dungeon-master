// Single source for the World seed enums. Feeds the form, the DB schema
// (CHECK constraints) and, later, the AI structured-output schema.

export const GENRE_FLAVORS = [
  'high fantasy',
  'dark fantasy',
  'sword and sorcery',
  'mythic',
  'gothic horror',
  'science fantasy',
  'science fiction',
  'post-apocalyptic'
] as const

export const SCALES = ['single region', 'continent', 'multiple continents', 'planar'] as const

export const MAGIC_LEVELS = ['none', 'low', 'moderate', 'high', 'ubiquitous'] as const

export const TECH_LEVELS = [
  'stone age',
  'ancient',
  'medieval',
  'renaissance',
  'industrial',
  'modern',
  'futuristic'
] as const

export type GenreFlavor = (typeof GENRE_FLAVORS)[number]
export type Scale = (typeof SCALES)[number]
export type MagicLevel = (typeof MAGIC_LEVELS)[number]
export type TechLevel = (typeof TECH_LEVELS)[number]

export const PREMISE_SOFT_CAP = 500
