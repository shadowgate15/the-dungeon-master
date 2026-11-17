/** The affordances setting: clickable NPCs, exits and objects that pre-fill the composer. */
export const AFFORDANCES_COOKIE = 'affordances'

/** Affordances are on unless the cookie says "off". */
export function parseAffordances(value: string | null | undefined): boolean {
  return value !== 'off'
}

export const talkText = (npc: { name: string }) => `I talk to ${npc.name}.`
export const goText = (exit: { name: string }) => `I head to ${exit.name}.`
export const examineText = (object: string) => `I examine ${object}.`
