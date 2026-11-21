/**
 * Affordances: the Declaration text for clickable NPCs, exits and objects. A clicked exit or NPC
 * declares it at once (with its Effect); a clicked object pre-fills the composer.
 */
export const talkText = (npc: { name: string }) => `I talk to ${npc.name}.`
export const goText = (exit: { name: string }) => `I head to ${exit.name}.`
export const examineText = (object: string) => `I examine ${object}.`
