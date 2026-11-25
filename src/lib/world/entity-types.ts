/** The kinds of World-layer Entity. Each type's handle prefix is its name. */
export const ENTITY_TYPES = ['npc', 'place', 'faction', 'topic'] as const
export type EntityType = (typeof ENTITY_TYPES)[number]

/**
 * Every kind of handle: the Entity types, a Character (`char:`), a Creature in the live Combat
 * (`creature:`) and an SRD stat block (`monster:`).
 */
export const HANDLE_KINDS = [...ENTITY_TYPES, 'char', 'creature', 'monster'] as const
export type HandleKind = (typeof HANDLE_KINDS)[number]

/** What a handle refers to, by its prefix; null for a name or an unknown prefix. */
export function handleKind(handle: string): HandleKind | null {
  const at = handle.indexOf(':')
  if (at <= 0 || at === handle.length - 1) return null
  const prefix = handle.slice(0, at)
  return (HANDLE_KINDS as readonly string[]).includes(prefix) ? (prefix as HandleKind) : null
}

/** An NPC's status. A dead NPC is not retired. */
export const NPC_STATUSES = ['alive', 'dead', 'missing', 'departed'] as const
