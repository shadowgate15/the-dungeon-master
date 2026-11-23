// Single source for the Campaign seed enums. Feeds the form and the DB schema (CHECK constraints).

/** The mood of play. Unordered. */
export const TONES = ['heroic', 'lighthearted', 'tense', 'dark', 'mysterious', 'epic'] as const

/**
 * Story scope, not hours. Ordered: one-shot (a single sitting), short (a few sessions),
 * medium (a season of play), long (an open-ended saga).
 */
export const LENGTHS = ['one-shot', 'short', 'medium', 'long'] as const

export type Tone = (typeof TONES)[number]
export type Length = (typeof LENGTHS)[number]

/** The service rejects a premise longer than this. */
export const PREMISE_SERVICE_MAX = 2000

/** The Seed card warns, but still saves, past this many premise characters. */
export const PREMISE_SOFT_CAP = 500

/** The service rejects a name longer than this. */
export const NAME_MAX = 80

// The optional World-shaping Campaign Seed fields. NULL (an empty card field) means unspecified.

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
