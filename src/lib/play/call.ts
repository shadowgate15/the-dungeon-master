/** A d20 roll's mode: advantage and disadvantage roll two dice and keep one. */
export type RollMode = 'normal' | 'advantage' | 'disadvantage'

/**
 * One part of the open Call as the Player sees it, addressed to one Controlling Player: a Check
 * for one Character (`label` names the skill or save, never the DC), or a question to answer.
 */
export type CallPart = {
  id: string
  /** The Character rolling; null for a question. */
  character: string | null
  player: string
  /** `Sleight of Hand check` or `Dexterity save`; null for a question. */
  label: string | null
  reason: string | null
  mode: RollMode
  answered: boolean
}

/**
 * The open Call, Player-safe: a Check (one part per Character) or a question (its text and
 * choices, free text when there are none).
 */
export type OpenCall = {
  id: string
  kind: 'check' | 'question'
  text: string | null
  choices: string[]
  parts: CallPart[]
}
