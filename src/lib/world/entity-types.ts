/** The kinds of World-layer Entity. Each type's handle prefix is its name. */
export const ENTITY_TYPES = ['npc', 'place', 'faction', 'topic'] as const
export type EntityType = (typeof ENTITY_TYPES)[number]

/** An NPC's status. A dead NPC is not retired. */
export const NPC_STATUSES = ['alive', 'dead', 'missing', 'departed'] as const
