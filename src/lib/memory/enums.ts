// Single source for the memory enums and text limits. Feeds the DB schema (CHECK constraints)
// and the extraction validator.

/** An NPC's standing in the story. `dead` is sticky: only an explicit revive undoes it. */
export const NPC_STATUSES = ['alive', 'dead', 'missing', 'departed'] as const

/** An NPC's stance toward a Character. */
export const STANCES = ['hostile', 'wary', 'neutral', 'friendly', 'allied'] as const

/** The five kinds of World memory record. */
export const MEMORY_KINDS = ['npc', 'place', 'faction', 'event', 'fact'] as const

export type NpcStatus = (typeof NPC_STATUSES)[number]
export type Stance = (typeof STANCES)[number]
export type MemoryKind = (typeof MEMORY_KINDS)[number]

/** Longest accepted text per field; longer proposals are rejected individually. */
export const MEMORY_LIMITS = {
  name: 80,
  description: 300,
  role: 80,
  note: 200,
  factTitle: 120,
  factDetail: 300,
  reason: 120
} as const
