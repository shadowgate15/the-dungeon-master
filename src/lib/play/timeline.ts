import type { OpenCall, RollMode } from './call'
import type { HpState } from './hp-state'

/** One entry in the Player's timeline. Every field is Player-safe: built by the server, never raw. */
export type TimelineEntry =
  /** What a Player said one Character does, once its Floor closed. */
  | { type: 'declaration'; id: string; character: string; player: string; text: string }
  /** The DM's Narration; `voice` names the NPC speaking, if any. */
  | { type: 'narration'; id: string; text: string; voice: string | null }
  /**
   * One roll, in one line: who (a Character, or an NPC rolling in the dice log), what, the dice
   * (both d20s on advantage, with the reason), the modifier, the total and the outcome (null for
   * damage). Never the AC or DC. `target` is an NPC or Creature hit by damage, as a state only.
   */
  | {
      type: 'roll'
      id: string
      character: string
      what: string
      dice: number[]
      modifier: number
      total: number
      outcome: RollOutcome | null
      mode: RollMode
      reason: string | null
      target: { name: string; state: HpState } | null
    }
  /** A Player's answer to a question Call. */
  | { type: 'answer'; id: string; player: string; question: string; text: string }
  /** A muted `⚙ DM …` line: what the DM did with one tool call. */
  | { type: 'activity'; id: string; text: string }
  /** Something went wrong with the turn, such as the DM ending it without a Narration. */
  | { type: 'error'; id: string; text: string }

/** What came of a roll: a Check or save, or an attack against an AC the Player never sees. */
export type RollOutcome = 'success' | 'failure' | 'hit' | 'miss' | 'critical hit'

/** The Player's timeline, the open Call, and when the DM started on the turn awaiting Narration (null if none). */
export type Timeline = {
  entries: TimelineEntry[]
  awaitingSince: number | null
  /** The open Call the Players are asked to answer, kept until answered or withdrawn. */
  call: OpenCall | null
}

/** About how long the DM takes to answer a turn, for the progress bar. */
export const EXPECTED_TURN_SECONDS = 20
