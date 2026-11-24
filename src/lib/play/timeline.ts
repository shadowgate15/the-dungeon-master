/** One entry in the Player's timeline. Every field is Player-safe: built by the server, never raw. */
export type TimelineEntry =
  /** What a Player said one Character does, once its Floor closed. */
  | { type: 'declaration'; id: string; character: string; player: string; text: string }
  /** The DM's Narration; `voice` names the NPC speaking, if any. */
  | { type: 'narration'; id: string; text: string; voice: string | null }
  /** A muted `⚙ DM …` line: what the DM did with one tool call. */
  | { type: 'activity'; id: string; text: string }

/** The Player's timeline, and when the DM started on the turn awaiting Narration (null if none). */
export type Timeline = { entries: TimelineEntry[]; awaitingSince: number | null }

/** About how long the DM takes to answer a turn, for the progress bar. */
export const EXPECTED_TURN_SECONDS = 20
