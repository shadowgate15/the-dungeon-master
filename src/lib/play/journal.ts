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

/** Whether a Character holds an entry themselves. */
export const holds = (entry: JournalEntry, character: string) =>
  entry.holders.some((h) => h.id === character)

/**
 * "What <Character> knows": the entries they hold, then the rest of the Party's, which the
 * Character can be told about at the table.
 */
export const knownBy = (journal: Journal, character: string): JournalEntry[] => [
  ...journal.entries.filter((e) => holds(e, character)),
  ...journal.entries.filter((e) => !holds(e, character))
]
