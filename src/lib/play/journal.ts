import type { EntityType } from '#lib/world/entity-types.ts'

/** One of the Player's Characters who holds a Journal entry. */
export type JournalHolder = { id: string; name: string }

/**
 * One thing the Player's Characters believe, as they learned it. Player-safe: built by the server
 * from Beliefs alone, with no truth, no outdatedness and no handles.
 */
export type JournalEntry = {
  id: string
  about: { name: string; type: EntityType }
  text: string
  source: string | null
  holders: JournalHolder[]
}

/** The Player's Journal: the union of their Characters' Beliefs. */
export type Journal = { entries: JournalEntry[] }

/** The entries a Character holds: "What <Character> knows". */
export const knownBy = (journal: Journal, character: string): JournalEntry[] =>
  journal.entries.filter((e) => e.holders.some((h) => h.id === character))
