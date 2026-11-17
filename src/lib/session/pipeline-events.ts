import type { EventKind, Role, SessionEvent } from './enums.ts'

/** Per-run counters shown in the event inspector. */
export interface RunStats {
  steps: number
  directorCalls: number
  retries: number
  fallbacks: number
  capHits: number
}

/** One Director step, as the event inspector shows it. */
export interface StepMessage {
  type: 'step'
  step: number
  role: Role
  menu: string[]
  pick: string
  /** The first answer was unusable, so the Director was asked once more. */
  retried: boolean
  /** Both answers were unusable, so code chose the pick. */
  fallback: boolean
  /** What the Director said, one entry per call. */
  raw: string[]
}

/** Why control returned to the player. */
export type DoneReason = 'yield' | 'cap' | 'roll' | 'stopped' | 'error'

/**
 * What a run streams, from the server's pipeline to the browser. `event` carries a committed Event
 * log entry; `done` ends the run. Consumers ignore variants they do not know, and nothing but
 * `event` variants is persisted.
 */
export type PipelineEvent =
  | { type: 'event'; event: SessionEvent }
  /** The Director is choosing; shown as a thinking indicator until the next event, delta or done. */
  | { type: 'thinking'; role: Role }
  /** A token of the in-flight event. It is not in the log yet, and may still be discarded. */
  | { type: 'delta'; role: Role; kind: EventKind; text: string; npcId?: string }
  /** The in-flight event was stopped or failed: drop what the deltas built. Nothing was saved. */
  | { type: 'discard' }
  /** Inspector: one Director step, with its role, the menu it saw and the pick that ran. */
  | StepMessage
  /** Inspector: running counters for this run. Not persisted. */
  | { type: 'stats'; stats: RunStats }
  | { type: 'done'; reason: DoneReason; message?: string }

/** The `name` of the AG-UI `CUSTOM` chunk that carries one `PipelineEvent` as its `value`. */
export const PIPELINE_CHUNK = 'dm.pipeline'
