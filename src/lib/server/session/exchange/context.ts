import type { SessionEvent } from '#lib/session/enums.ts'
import type { ContextReport } from '#lib/session/exchange-events.ts'
import type { ChatPort } from '../../ai/port.ts'
import type { Steering } from '../../arc/beat-progress.ts'
import type { ContextSources } from '../context/sources.ts'
import type { SessionService } from '../service.ts'
import type { CharacterLine } from './contract.ts'

/** Everything an Exchange step may use. State lives in the database, never in the Exchange. */
export interface ExchangeContext {
  sessionId: string
  sessions: SessionService
  port: ChatPort
  /** Aborted when the player presses Stop or disconnects. */
  signal: AbortSignal
  /** The Arc steering for the Reply, read fresh per call; null (or absent) when there is none. */
  steering?: () => Steering | null
  /** The Rolling summary, World memory and Character for the prompts; absent in some tests. */
  context?: ContextSources
  /** Reports a built context's usage, so the run can add it to its stats. */
  report?: (report: ContextReport) => void
  /** Counts a retried answer or an applied default against the running step. */
  tally?: (what: 'retry' | 'default') => void
}

/** Used when the Character cannot be read (a test without context sources). */
const SOMEONE: CharacterLine = { name: 'The player character', summary: 'an adventurer' }

export const characterOf = (ctx: ExchangeContext): CharacterLine =>
  ctx.context?.character?.(ctx.sessionId) ?? SOMEONE

/** How many recent events the ruling steps are given before trimming. */
const RECENT_EVENTS = 8

/** The events before the Declaration, most recent last, for the ruling steps. */
export const eventsBefore = (ctx: ExchangeContext, declaration: SessionEvent): SessionEvent[] =>
  ctx.sessions
    .events(ctx.sessionId)
    .filter((e) => e.seq < declaration.seq)
    .slice(-RECENT_EVENTS)
