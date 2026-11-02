/** The Campaign Seed card's live values. An empty string means unset. */
export type CampaignSeedCard = {
  name: string
  premise: string
  tone: string
  length: string
  /** Chosen World ids. Only the player chooses these; the AI never proposes Worlds. */
  worldIds: string[]
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
