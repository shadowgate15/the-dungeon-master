/**
 * The Call (GLOSSARY.md, ADR 0005): what an Exchange asks of the player before it can go on. It
 * lives on the Scene as `openCall` until it is answered or withdrawn, so a reload keeps it. Shared
 * by the server and the UI; the client only ever sees a `CallView`, never the DC.
 *
 * Today a Call is a Check. A question Call (#273) joins the `Call` union with its own `kind`, and
 * its answers join `CallAnswer`.
 */

/** The Declaration a Call belongs to: the event that started the Exchange it paused. */
export interface CallDeclaration {
  seq: number
  text: string
}

/**
 * An Effect decided before the Call was raised (a clicked exit or NPC, #274), applied instead of
 * asking the Effect step once the Call resolves in the player's favour.
 */
export type CarriedEffect = { effect: 'move'; exitId: string } | { effect: 'talk'; npcId: string }

/** A Check the player rolls: a skill or save slug (`athletics`, `constitution_save`). */
export interface CheckCall {
  kind: 'check'
  skill: string
  difficulty: string
  /** From the difficulty map; server-side only. */
  dc: number
  declaration: CallDeclaration
  effect?: CarriedEffect
}

export type Call = CheckCall

/** A Call as the client sees it: everything but the DC. */
export type CallView = Omit<CheckCall, 'dc'>

/** How the player answers a Call. A roll carries nothing: code rolls. */
export type CallAnswer = { kind: 'roll' }

/** A Check's result, as the `call-answered` event's data holds it (with the DC server-side). */
export interface CheckRoll {
  die: number
  modifier: number
  total: number
  success: boolean
}

/** A skill or save slug as the player reads it: `sleight_of_hand` is "Sleight of hand". */
export function checkLabel(skill: string): string {
  const words = skill.replaceAll('_', ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** A Check result line: die + modifier = total, success or failure. Never the DC. */
export function rollLine(skill: string, roll: CheckRoll): string {
  const sign = roll.modifier < 0 ? '-' : '+'
  return `${checkLabel(skill)}: ${roll.die} ${sign} ${Math.abs(roll.modifier)} = ${roll.total}, ${roll.success ? 'success' : 'failure'}`
}
