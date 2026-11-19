/**
 * World memory vocabulary shared by the database schema (CHECK constraints), validators, the
 * server and the UI. See GLOSSARY.md (World memory, Place, NPC, NPC memory, Fact, Retired, Beat
 * state, Rolling summary).
 */

/** An NPC's status. Separate from Retired: a dead NPC is not retired. */
export const NPC_STATUSES = ['alive', 'dead', 'missing', 'departed'] as const
export type NpcStatus = (typeof NPC_STATUSES)[number]

/** How an NPC feels about a Character: the `(npc, character)` disposition's stance. */
export const STANCES = ['hostile', 'wary', 'neutral', 'friendly', 'allied'] as const
export type Stance = (typeof STANCES)[number]

/** A Beat leaves `pending` once and never returns. */
export const BEAT_STATES = ['pending', 'reached', 'abandoned'] as const
export type BeatState = (typeof BEAT_STATES)[number]

/** What a memory-run row records an attempt of. */
export const MEMORY_RUN_KINDS = ['extraction', 'summary'] as const
export type MemoryRunKind = (typeof MEMORY_RUN_KINDS)[number]

export const MEMORY_RUN_OUTCOMES = ['success', 'failure'] as const
export type MemoryRunOutcome = (typeof MEMORY_RUN_OUTCOMES)[number]

/** One dropped item of a memory run: its kind and why, never its text. */
export interface DroppedItem {
  kind: string
  reason: string
}

/** Text length caps, in characters. Tunable. */
export const MEMORY_MAX = {
  placeName: 80,
  placeDescription: 400,
  exitName: 60,
  npcName: 80,
  npcDescription: 300,
  npcRole: 80,
  dispositionNote: 200,
  factTitle: 120,
  factDetail: 300,
  retiredReason: 200,
  summary: 1600
} as const
