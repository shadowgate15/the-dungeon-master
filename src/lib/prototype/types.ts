// PROTOTYPE (throwaway): shared types for the scene-director prototype. See README.md.

export type Mode = 'exploration' | 'dialogue'
export type Role = 'player' | 'director' | 'narrator' | 'npc' | 'code'
export type EventKind =
  | 'player-action'
  | 'narration'
  | 'npc-line'
  | 'roll-requested'
  | 'roll-resolved'
  | 'scene-changed'
  | 'mode-changed'

export interface RollInfo {
  check: string
  dc: number
  d20?: number
  modifier?: number
  total?: number
  success?: boolean
}

/** One entry of the append-only event log, tagged with the role that produced it. */
export interface SceneEvent {
  id: string
  seq: number
  kind: EventKind
  role: Role
  text: string
  npcId?: string
  npcName?: string
  roll?: RollInfo
}

export interface NpcView {
  id: string
  name: string
  occupation: string
  persona: string
  attitude: string
  knowledge: string
}

export interface LocationView {
  id: string
  name: string
  description: string
  exits: { id: string; label: string }[]
  objects: string[]
}

export interface PendingRoll {
  check: string
  dc: number
  reason: string
}

/** Everything code holds about the scene; the UI renders this and the director's menu comes from it. */
export interface SceneState {
  location: LocationView
  npcsPresent: NpcView[]
  mode: Mode
  dialogueNpcId: string | null
  pendingRoll: PendingRoll | null
  log: SceneEvent[]
}

export interface RunStats {
  steps: number
  directorCalls: number
  retries: number
  fallbacks: number
  capHits: number
}

export interface DirectorTrace {
  step: number
  menu: string[]
  raw: (string | undefined)[]
  pick: string
  retried: boolean
  fallback: boolean
}

export type DoneReason = 'yield' | 'cap' | 'roll' | 'stopped' | 'error'

/** One NDJSON line of a pipeline run. */
export type StreamMsg =
  | { t: 'state'; state: SceneState }
  | { t: 'thinking'; role: 'director' | 'narrator' | 'npc'; step: number; npcName?: string }
  | { t: 'director'; trace: DirectorTrace }
  | { t: 'start'; id: string; kind: EventKind; role: Role; npcId?: string; npcName?: string }
  | { t: 'delta'; id: string; text: string }
  | { t: 'discard'; id: string }
  | { t: 'stats'; stats: RunStats }
  | { t: 'done'; reason: DoneReason; stats: RunStats }
  | { t: 'error'; message: string }

export interface StepRequest {
  action?: string
  roll?: boolean
  fake?: boolean
  stepCap?: number
}
