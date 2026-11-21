/**
 * What one Exchange streams from the server to the browser (see GLOSSARY.md and ADR 0005), and the
 * per-run stats the dev inspector shows. Shared by the server and the UI.
 */
import type { EventKind, Role, SessionEvent } from './enums.ts'

/** The fixed steps of an Exchange, in order. */
export const EXCHANGE_STEPS = ['adjudication', 'effect', 'reply'] as const
export type ExchangeStep = (typeof EXCHANGE_STEPS)[number]

/** The roles whose context is built and budgeted. */
export type ContextRole = 'adjudication' | 'effect' | 'narrator' | 'npc'

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

/** What one step of the Exchange cost. */
export interface StepStats {
  /** Model requests the step made, retries included. */
  requests: number
  /** Invalid answers asked again. */
  retries: number
  /** Safe defaults applied after the retry also failed validation. */
  defaults: number
  /** Wall time the step took so far, in milliseconds. */
  latencyMs: number
}

/** Per-Exchange counters shown in the event inspector, by step. */
export interface RunStats {
  steps: Partial<Record<ExchangeStep, StepStats>>
  /** Context usage so far this run. */
  context?: ContextStats
}

/** A validated Adjudication, as the inspector shows it. Never carries a DC. */
export interface RulingAdjudication {
  outcome: 'happens' | 'impossible' | 'check' | 'ask'
  skill?: string
  difficulty?: string
  question?: string
  choices?: string[]
}

/** A validated Effect, as the inspector shows it. */
export interface RulingEffect {
  effect: 'none' | 'move' | 'talk' | 'end_talk'
  exitId?: string
  npcId?: string
}

/** Inspector: how this Exchange was ruled, before the Reply streams. */
export interface RulingMessage {
  type: 'ruling'
  adjudication: RulingAdjudication
  /** The Effect that was applied; null when none ran (the Declaration was impossible, failed its check, or raised a Call). */
  effect: RulingEffect | null
}

/** Why the Exchange handed the floor back to the player: `call` means it waits on an open Call. */
export type DoneReason = 'replied' | 'call' | 'stopped' | 'error'

/**
 * What an Exchange streams. `event` carries a committed Event log entry; `done` ends the run.
 * Consumers ignore variants they do not know, and nothing but `event` variants is persisted.
 */
export type ExchangeEvent =
  | { type: 'event'; event: SessionEvent }
  /** A step is running; shown as a thinking indicator until the next event, delta or done. */
  | { type: 'thinking'; step: ExchangeStep }
  /** A token of the in-flight Reply. It is not in the log yet, and may still be discarded. */
  | { type: 'delta'; role: Role; kind: EventKind; text: string; npcId?: string }
  /** The in-flight Reply was stopped or failed: drop what the deltas built. Nothing was saved. */
  | { type: 'discard' }
  | RulingMessage
  /** Inspector: running counters for this run. Not persisted. */
  | { type: 'stats'; stats: RunStats }
  | { type: 'done'; reason: DoneReason; message?: string }

/** The `name` of the AG-UI `CUSTOM` chunk that carries one `ExchangeEvent` as its `value`. */
export const EXCHANGE_CHUNK = 'dm.exchange'
