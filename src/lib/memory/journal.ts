import type { MemoryKind, NpcStatus, Stance } from './enums.ts'

/** What an entry's chip says: new since the player last looked, or changed (and what, if known). */
export type JournalChip = { type: 'new' } | { type: 'updated'; what: string | null }

/** One Journal entry: a World memory record as the player sees it. */
export interface JournalEntry {
  id: string
  kind: MemoryKind
  name: string
  summary: string
  /** The number of the Session the record first appeared in. */
  session: number
  /** NPCs only. */
  role?: string
  status?: NpcStatus
  /** NPCs only: the stance toward the Character playing, when one is known. */
  stance?: Stance
  /** NPCs only: the titles of the facts they know. */
  knows?: string[]
  chip: JournalChip | null
}

/** A position in the story: a Session and a Turn seq within it. */
export interface JournalPosition {
  sessionId: string
  seq: number
}

export interface JournalView {
  /** In story order: by Session, then by when the record was first written. */
  entries: JournalEntry[]
  /** How many entries are new or changed since the player last looked. */
  unseen: number
  /** The latest position shown, sent back on close so the marker never passes unseen records. */
  through?: JournalPosition
}

/** The kinds in index order, with their labels. */
export const JOURNAL_KINDS: { kind: MemoryKind; label: string; plural: string }[] = [
  { kind: 'npc', label: 'Person', plural: 'People' },
  { kind: 'place', label: 'Place', plural: 'Places' },
  { kind: 'faction', label: 'Faction', plural: 'Factions' },
  { kind: 'event', label: 'Event', plural: 'Events' },
  { kind: 'fact', label: 'Fact', plural: 'Facts' }
]

export const chipLabel = (chip: JournalChip) =>
  chip.type === 'new' ? 'New' : chip.what ? `Updated: ${chip.what}` : 'Updated'

/** The entries of one kind, or all of them. */
export const entriesOfKind = (entries: JournalEntry[], kind: MemoryKind | 'all') =>
  kind === 'all' ? entries : entries.filter((e) => e.kind === kind)

/** Entries grouped by the Session they first appeared in, newest Session first. */
export function groupBySession(entries: JournalEntry[]) {
  const sessions = [...new Set(entries.map((e) => e.session))].sort((a, b) => b - a)
  return sessions.map((session) => ({
    session,
    entries: entries.filter((e) => e.session === session)
  }))
}
