/**
 * The Scene and Event log vocabulary shared by the database schema (CHECK constraints), the server
 * and the UI. See GLOSSARY.md (Scene, Mode, Exchange, Event log) and docs/adr/0003 and 0005.
 */

import { STANCES, type Stance } from '#lib/memory/enums.ts'
import type { Call, CallView } from './call.ts'

/** The kind of exchange a Scene is in. A Call is an overlay on any Mode, never a Mode. */
export const MODES = ['exploration', 'dialogue'] as const
export type Mode = (typeof MODES)[number]

/** Who produced an Event: the player, a voice of the Reply, or deterministic code. */
export const ROLES = ['player', 'narrator', 'npc', 'code'] as const
export type Role = (typeof ROLES)[number]

/**
 * The typed events of the Event log. A `declaration` starts each Exchange; `call-raised` and
 * `call-answered` record a Call (a withdrawn Call is a `call-answered` with a withdrawn flag).
 */
export const EVENT_KINDS = [
  'declaration',
  'narration',
  'npc-line',
  'call-raised',
  'call-answered',
  'scene-changed',
  'mode-changed'
] as const
export type EventKind = (typeof EVENT_KINDS)[number]

/** How an NPC feels about the player's Character: the stance of its disposition. */
export const ATTITUDES = STANCES
export type Attitude = Stance

export interface SceneExit {
  /** Stable id; a `move` Effect names it. */
  id: string
  name: string
}

/**
 * An NPC present in the Scene, as a view resolved live from World memory on every read; the Scene
 * itself stores only the NPC row ids. Only alive, non-retired NPCs resolve.
 */
export interface SceneNpc {
  /** The NPC row id: what the Scene stores and what Events and `dialogueNpcId` refer to. */
  id: string
  /** The NPC's unique name key, hyphenated. */
  key: string
  name: string
  /** The `(npc, character)` stance, neutral when none is recorded. */
  attitude: Attitude
  /** The disposition note plus the linked Facts the NPC knows; the NPC voice sees only its own. */
  knowledge: string
}

/**
 * Where and how play stands right now, with NPCs resolved from World memory (the stored Scene
 * holds their ids only). Owned by code; the AI never edits it freely.
 */
export interface SceneState {
  location: { name: string; description: string }
  exits: SceneExit[]
  objects: string[]
  npcs: SceneNpc[]
  mode: Mode
  /** The NPC being talked to while `mode` is `dialogue`, else null. */
  dialogueNpcId: string | null
  /** What the Exchange is waiting on the player for; it survives a reload. Holds the DC. */
  openCall: Call | null
}

/** The Scene as the client sees it: the open Call without its DC. */
export type SceneView = Omit<SceneState, 'openCall'> & { openCall: CallView | null }

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
  /** Kind-specific structured payload (a Call's skill and result, a scene change's target). */
  data: Record<string, unknown> | null
  createdAt: number
}
