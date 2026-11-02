import { LENGTHS, TONES } from './enums.ts'

export const CAMPAIGN_SEED_FIELDS = ['name', 'premise', 'tone', 'length'] as const

export type CampaignSeedField = (typeof CAMPAIGN_SEED_FIELDS)[number]

/** The Campaign seed card's live values. An empty string means unset. */
export type CampaignSeedCard = Record<CampaignSeedField, string>

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
