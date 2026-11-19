import type { EventKind, Role, SessionEvent } from './enums.ts'

/** The roles whose context is built and budgeted. */
export type ContextRole = 'director' | 'narrator' | 'npc'

/** Trim steps fired while building context. Counts only, never what was trimmed. */
export interface TrimCounts {
  /** World memory entries taken names-only or dropped. */
  memory: number
  /** Events dropped from context (the Event log is untouched). */
  events: number
  /** Summary tail sentences cut. */
  summary: number
  /** Of the dropped events, those the summary did not cover (a summary that keeps failing). */
  uncovered: number
}

/** One built context: tokens used against the role's cap, plus what the Narrator's held. */
export interface ContextReport {
  role: ContextRole
  /** Estimated tokens of the whole prompt. */
  used: number
  cap: number
  /** Tokens of World memory shown (Narrator only; 0 for the other roles). */
  memoryUsed: number
  memoryBudget: number
  /** Events shown verbatim. */
  verbatim: number
  /** Events the summary stands in for (Narrator only; 0 for the other roles). */
  summarised: number
  trims: TrimCounts
}

/** Per-run context reporting: the latest report per role, and trim counts summed over the run. */
export interface ContextStats {
  roles: Partial<Record<ContextRole, ContextReport>>
  trims: TrimCounts
}

/** Per-run counters shown in the event inspector. */
export interface RunStats {
  steps: number
  directorCalls: number
  retries: number
  fallbacks: number
  capHits: number
  /** Context usage so far this run; absent from a pipeline that does not report it. */
  context?: ContextStats
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
  /** The Director's context for this step: tokens used against its cap, trims fired. */
  context?: ContextReport
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
