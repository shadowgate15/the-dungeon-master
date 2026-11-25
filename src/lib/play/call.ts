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
  /**
   * A roll sequence's next roll (`to hit`, then `damage`; or `save`), null once it is done and for
   * a Check or question. The AC or DC it is rolled against is never here.
   */
  next: 'to hit' | 'damage' | 'save' | null
}

/**
 * The open Call, Player-safe: a Check (one part per Character), a question (its text and
 * choices, free text when there are none), an action's roll sequences (one per Character),
 * Combat initiative (one roll per Character), or a downed Character's Death save.
 */
export type OpenCall = {
  id: string
  kind: 'check' | 'question' | 'roll_sequence' | 'initiative' | 'death_save'
  text: string | null
  choices: string[]
  parts: CallPart[]
}
