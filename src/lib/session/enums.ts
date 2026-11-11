export const TURN_AUTHORS = ['dm', 'player'] as const
export type TurnAuthor = (typeof TURN_AUTHORS)[number]

/** `narration` is a DM turn, `action` and `roll_result` are player turns. */
export const TURN_KINDS = ['narration', 'action', 'roll_result'] as const
export type TurnKind = (typeof TURN_KINDS)[number]

/** A DM turn's call for a check. The DC is shown to the player. */
export type RollRequest = {
  check: 'ability' | 'skill'
  key: string
  dc: number
  reason: string
}

/** The player turn that answers a Roll request. */
export type RollResult = { d20: number; modifier: number; total: number }
