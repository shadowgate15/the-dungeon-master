/** Affordances: clickable NPCs, exits and objects that pre-fill the composer. */
export const talkText = (npc: { name: string }) => `I talk to ${npc.name}.`
export const goText = (exit: { name: string }) => `I head to ${exit.name}.`
export const examineText = (object: string) => `I examine ${object}.`
