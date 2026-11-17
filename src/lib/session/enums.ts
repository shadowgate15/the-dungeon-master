/**
 * The Scene and Event log vocabulary shared by the database schema (CHECK constraints), the server
 * and the UI. See GLOSSARY.md (Scene, Mode, Director, Event log) and docs/adr/0003.
 */

/** The kind of exchange a Scene is in. A roll is an overlay on any Mode, never a Mode. */
export const MODES = ['exploration', 'dialogue'] as const
export type Mode = (typeof MODES)[number]

/** Who produced an Event: the player, a pipeline role, or deterministic code. */
export const ROLES = ['player', 'director', 'narrator', 'npc', 'code'] as const
export type Role = (typeof ROLES)[number]

/** The typed events of the Event log. */
export const EVENT_KINDS = [
  'player-action',
  'narration',
  'npc-line',
  'roll-requested',
  'roll-resolved',
  'scene-changed',
  'mode-changed'
] as const
export type EventKind = (typeof EVENT_KINDS)[number]

/** How an NPC feels about the player's Character. */
export const ATTITUDES = ['hostile', 'wary', 'neutral', 'friendly'] as const
export type Attitude = (typeof ATTITUDES)[number]

export interface SceneExit {
  /** Stable id; the Director's `move:<id>` menu option names it. */
  id: string
  name: string
}

export interface SceneNpc {
  /** Stable id; the Director's `npc-speaks:<id>` menu option names it. */
  id: string
  name: string
  attitude: Attitude
  /** A short note of what this NPC knows; the NPC voice sees only its own. */
  knowledge: string
}

/** A roll the player owes. Stays pending until the player rolls, so a reload cannot skip it. */
export interface PendingRoll {
  check: string
  dc: number
  reason: string
}

/** Where and how play stands right now. Owned by code; the AI never edits it freely. */
export interface SceneState {
  location: { name: string; description: string }
  exits: SceneExit[]
  objects: string[]
  npcs: SceneNpc[]
  mode: Mode
  /** The NPC being talked to while `mode` is `dialogue`, else null. */
  dialogueNpcId: string | null
  pendingRoll: PendingRoll | null
}

/** One entry of a Session's append-only Event log. */
export interface SessionEvent {
  id: string
  sessionId: string
  /** Monotonic per Session, from 1. */
  seq: number
  role: Role
  kind: EventKind
  /** The prose, action or line; null for kinds that carry only `data`. */
  text: string | null
  /** The speaking NPC, for `npc-line`. */
  npcId: string | null
  /** Kind-specific structured payload (a roll's check, DC and result, a scene change's target). */
  data: Record<string, unknown> | null
  createdAt: number
}
