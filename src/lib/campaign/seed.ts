export const CAMPAIGN_SEED_FIELDS = ['name', 'premise', 'tone', 'length'] as const

export type CampaignSeedField = (typeof CAMPAIGN_SEED_FIELDS)[number]

/** The Campaign Seed card's live values. An empty string means unset. */
export type CampaignSeedCard = Record<CampaignSeedField, string>

export function emptyCampaignSeed(): CampaignSeedCard {
  return { name: '', premise: '', tone: '', length: '' }
}

/** Create stays disabled until every field is set. */
export function isCampaignSeedComplete(seed: CampaignSeedCard): boolean {
  return (
    seed.name.trim() !== '' && seed.premise.trim() !== '' && seed.tone !== '' && seed.length !== ''
  )
}
