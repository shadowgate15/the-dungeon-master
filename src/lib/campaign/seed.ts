import {
  GENRE_FLAVORS,
  LENGTHS,
  MAGIC_LEVELS,
  NAME_MAX,
  PREMISE_SERVICE_MAX,
  SCALES,
  TECH_LEVELS,
  TONES,
  type GenreFlavor,
  type Length,
  type MagicLevel,
  type Scale,
  type TechLevel,
  type Tone
} from './enums'

/** Every Campaign Seed field, in the Seed card's order. */
export const CAMPAIGN_SEED_FIELDS = [
  'name',
  'premise',
  'tone',
  'length',
  'worldName',
  'genreFlavor',
  'scale',
  'magicLevel',
  'techLevel'
] as const

/** The fields a complete Seed must have; the rest are optional. */
export const REQUIRED_SEED_FIELDS = ['name', 'premise', 'tone', 'length'] as const

export type CampaignSeedField = (typeof CAMPAIGN_SEED_FIELDS)[number]
export type RequiredSeedField = (typeof REQUIRED_SEED_FIELDS)[number]

/** The Campaign Seed card's live values. An empty string means unset. */
export type CampaignSeedCard = Record<CampaignSeedField, string>

export function emptyCampaignSeed(): CampaignSeedCard {
  return Object.fromEntries(CAMPAIGN_SEED_FIELDS.map((f) => [f, ''])) as CampaignSeedCard
}

/** The required fields still blank, in card order. */
export function missingSeedFields(seed: CampaignSeedCard): RequiredSeedField[] {
  return REQUIRED_SEED_FIELDS.filter((f) => seed[f].trim() === '')
}

/** Complete once every required field is set. */
export function isCampaignSeedComplete(seed: CampaignSeedCard): boolean {
  return missingSeedFields(seed).length === 0
}

/** The stored Campaign Seed. `null` means unset. */
export type CampaignSeed = {
  name: string
  premise: string | null
  tone: Tone | null
  length: Length | null
  worldName: string | null
  genreFlavor: GenreFlavor | null
  scale: Scale | null
  magicLevel: MagicLevel | null
  techLevel: TechLevel | null
}

/** The Seed breaks a rule: a blank name, over-long text or a value outside its list. */
export class CampaignSeedError extends Error {}

function text(label: string, value: string | undefined, max: number): string | null {
  const trimmed = (value ?? '').trim()
  if (trimmed.length > max)
    throw new CampaignSeedError(`${label} must be at most ${max} characters`)
  return trimmed === '' ? null : trimmed
}

function oneOf<T extends string>(label: string, values: readonly T[], value: string | undefined) {
  if (!value) return null
  if (!(values as readonly string[]).includes(value)) {
    throw new CampaignSeedError(`Invalid ${label}: ${value}`)
  }
  return value as T
}

/**
 * The card's values as a stored Seed. An incomplete Seed is fine (blanks become unset), but a
 * Campaign always has a name, and set values must be valid.
 */
export function parseCampaignSeed(card: Partial<CampaignSeedCard>): CampaignSeed {
  const name = text('Name', card.name, NAME_MAX)
  if (!name) throw new CampaignSeedError('Name is required')
  return {
    name,
    premise: text('Premise', card.premise, PREMISE_SERVICE_MAX),
    tone: oneOf('tone', TONES, card.tone),
    length: oneOf('length', LENGTHS, card.length),
    worldName: text('World name', card.worldName, NAME_MAX),
    genreFlavor: oneOf('genre flavor', GENRE_FLAVORS, card.genreFlavor),
    scale: oneOf('scale', SCALES, card.scale),
    magicLevel: oneOf('magic level', MAGIC_LEVELS, card.magicLevel),
    techLevel: oneOf('tech level', TECH_LEVELS, card.techLevel)
  }
}

/** A stored Seed as card values. */
export function campaignSeedCard(seed: CampaignSeed): CampaignSeedCard {
  return Object.fromEntries(CAMPAIGN_SEED_FIELDS.map((f) => [f, seed[f] ?? ''])) as CampaignSeedCard
}
