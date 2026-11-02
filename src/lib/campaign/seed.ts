import { LENGTHS, TONES } from './enums.ts'

export const CAMPAIGN_SEED_FIELDS = ['name', 'premise', 'tone', 'length'] as const

export type CampaignSeedField = (typeof CAMPAIGN_SEED_FIELDS)[number]

/** The AI-proposable seed fields. An empty string means unset. */
export type CampaignSeedFields = Record<CampaignSeedField, string>

/**
 * The Campaign Seed card's live values. `worldIds` are the chosen World ids; only the
 * player chooses these, the AI never proposes Worlds.
 */
export type CampaignSeedCard = CampaignSeedFields & { worldIds: string[] }

export const CAMPAIGN_FIELD_LABELS: Record<CampaignSeedField, string> = {
  name: 'Name',
  premise: 'Premise',
  tone: 'Tone',
  length: 'Length'
}

/** Allowed values for the enum-backed fields; undefined for free text. */
export const CAMPAIGN_FIELD_OPTIONS: Partial<Record<CampaignSeedField, readonly string[]>> = {
  tone: TONES,
  length: LENGTHS
}

export function emptyCampaignSeed(worldIds: string[] = []): CampaignSeedCard {
  return { name: '', premise: '', tone: '', length: '', worldIds: [...worldIds] }
}

/** Create stays disabled until every field, including at least one World, is set. */
export function isCampaignSeedComplete(seed: CampaignSeedCard): boolean {
  return (
    seed.name.trim() !== '' &&
    seed.premise.trim() !== '' &&
    seed.tone !== '' &&
    seed.length !== '' &&
    seed.worldIds.length > 0
  )
}
