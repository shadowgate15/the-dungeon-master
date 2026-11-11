import type { RollRequest, TurnAuthor } from './enums.ts'

/**
 * The derived Turn lifecycle states. Nothing is stored: the state is read from the last Turn.
 * The fourth state in the spec, generating, is a live server fact (a call in flight), not a
 * property of the transcript, so it is not here.
 *
 * - `unopened`: no Turns yet; the DM must open the Session.
 * - `awaiting-action`: the DM has narrated; the player acts.
 * - `pending-roll`: the DM asked for a roll; the player must roll.
 * - `unanswered`: the player has acted and the DM has not answered (a Stop, failure or closed
 *   tab discarded the reply); Retry answers it.
 */
export type TurnState = 'unopened' | 'awaiting-action' | 'pending-roll' | 'unanswered'

export function deriveTurnState(
  turns: readonly { author: TurnAuthor; rollRequest?: RollRequest | null }[]
): TurnState {
  const last = turns.at(-1)
  if (!last) return 'unopened'
  if (last.author === 'player') return 'unanswered'
  return last.rollRequest ? 'pending-roll' : 'awaiting-action'
}
