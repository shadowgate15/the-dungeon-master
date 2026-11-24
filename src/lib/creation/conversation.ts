import type { CampaignSeedCard } from '#lib/campaign/seed.ts'
import type { CharacterDraft } from '#lib/character/draft.ts'

/** One line of the creation conversation, as the DM pane shows it. */
export type ConversationMessage = {
  id: number
  /** `dm_write` is a muted line for a field the DM set. */
  author: 'player' | 'dm' | 'dm_write'
  player: string | null
  text: string
  createdAt: number
}

/** The Seed card's values with the fields the DM set, marked "✎ DM". */
export type SeedWithMarks = { seed: CampaignSeedCard; dmFields: string[] }

/** A stored Character draft as the open wizard refetches it after a DM write. */
export type DraftWithMarks = { draft: CharacterDraft; version: number; dmFields: string[] }
