// Single source for Character enums and limits. Feeds the service and the DB schema (CHECKs).

/** The nine alignments; slugs match the Rules Data alignments. NULL means unspecified. */
export const ALIGNMENTS = [
  'lawful-good',
  'neutral-good',
  'chaotic-good',
  'lawful-neutral',
  'neutral',
  'chaotic-neutral',
  'lawful-evil',
  'neutral-evil',
  'chaotic-evil'
] as const

/** Ability Score Methods; slugs match the app-authored Rules Data rows. */
export const ABILITY_METHODS = ['standard-array', 'point-buy', 'roll'] as const

/** Where a stored skill or spell pick comes from. */
export const PICK_SOURCES = ['class', 'race', 'background'] as const

/** The seeded app-authored background that requires the custom_background_* fields. */
export const CUSTOM_BACKGROUND_SLUG = 'custom'

export const NAME_MAX = 80
/** appearance, personality, ideal, bond, flaw */
export const TEXT_MAX = 500
export const BACKSTORY_MAX = 2000
export const CUSTOM_BACKGROUND_NAME_MAX = 80
export const CUSTOM_BACKGROUND_FEATURE_MAX = 1000

export type Alignment = (typeof ALIGNMENTS)[number]
export type AbilityMethod = (typeof ABILITY_METHODS)[number]
export type PickSource = (typeof PICK_SOURCES)[number]
