/**
 * The scene runner: one Declaration in, a stream of Exchange events out. Code owns the loop; the
 * model only answers each step inside it (see GLOSSARY.md and docs/adr/0005).
 *
 * `begin` claims the Session, saves the Declaration as a `declaration` event, then runs one
 * Exchange over the chat port and the database-backed Scene and Event log. The stream ends with
 * exactly one `done` event saying why the floor went back to the player.
 */
import type { SessionEvent } from '#lib/session/enums.ts'
import type { ExchangeEvent } from '#lib/session/exchange-events.ts'
import type { ChatPort } from '../ai/port.ts'
import type { BeatProgress } from '../arc/beat-progress.ts'
import type { MemoryExtraction } from '../memory/extraction.ts'
import type { RollingSummary } from '../memory/summary.ts'
import type { ContextSources } from './context/sources.ts'
import { runExchange } from './exchange/run.ts'
import { SessionValidationError, type SessionService } from './service.ts'

export type { DoneReason, ExchangeEvent, RunStats } from '#lib/session/exchange-events.ts'
export type { ExchangeContext } from './exchange/context.ts'

export type BeginRefusal = 'not-found' | 'ended' | 'empty-action' | 'in-flight'

export type BeginResult =
  { ok: true; events: AsyncGenerator<ExchangeEvent> } | { ok: false; reason: BeginRefusal }

export interface SceneRunnerDeps {
  sessions: SessionService
  port: ChatPort
  /** Arc Beat-progress: steering for the Reply and the silent Beat check after each Exchange. */
  beatProgress?: BeatProgress
  /** World memory extraction, fired in the background after each Exchange that replied. */
  memory?: MemoryExtraction
  /** The Rolling summary, fired in the background alongside extraction. */
  summary?: RollingSummary
  /** What the prompts read beyond the log and Scene (summary, World memory, Character). */
  contextSources?: ContextSources
}

export function createSceneRunner(deps: SceneRunnerDeps) {
  const { sessions, port } = deps
  // Sessions with a run in flight. Claimed synchronously when a run starts, so two quick requests
  // cannot both pass the check.
  const inFlight = new Set<string>()
  // Background Beat checks, so a test (or shutdown) can wait for them.
  const background = new Set<Promise<void>>()

  function inBackground(task: Promise<void>) {
    background.add(task)
    void task.finally(() => background.delete(task))
  }

  /**
   * Fires the silent background work over a finished Exchange (the Beat check over its events,
   * memory extraction over the log past its watermark); never awaited by the run, never throws.
   */
  function checkBeats(sessionId: string, fromSeq: number) {
    if (deps.beatProgress) inBackground(deps.beatProgress.check(sessionId, fromSeq, port))
    if (deps.memory) inBackground(deps.memory.trigger(sessionId, port))
    if (deps.summary) inBackground(deps.summary.trigger(sessionId, port))
  }

  async function* run(
    sessionId: string,
    signal: AbortSignal,
    declaration: SessionEvent
  ): AsyncGenerator<ExchangeEvent> {
    try {
      const steering = deps.beatProgress && (() => deps.beatProgress!.steering(sessionId))
      const replied = yield* runExchange(
        { sessionId, sessions, port, signal, steering, context: deps.contextSources },
        declaration
      )
      if (replied) {
        checkBeats(sessionId, declaration.seq)
        yield { type: 'done', reason: 'replied' }
      } else {
        yield { type: 'done', reason: 'stopped' }
      }
    } catch (error) {
      if (signal.aborted) {
        yield { type: 'done', reason: 'stopped' }
      } else {
        // #275 adds retries and safe defaults; until then a failed step ends the Exchange here.
        yield {
          type: 'done',
          reason: 'error',
          message: error instanceof Error ? error.message : String(error)
        }
      }
    }
  }

  /** The refusals every run shares: the Session must exist and not have ended. */
  function refusal(sessionId: string): 'not-found' | 'ended' | null {
    const current = sessions.get(sessionId)
    if (!current) return 'not-found'
    return current.endedAt !== null ? 'ended' : null
  }

  /**
   * Starts a run: claims the Session, saves the run's first event (`record`) before any model
   * call, then streams that event and the Exchange's. The claim is held until the stream actually
   * finishes, so a stopped run cannot overlap the next one while the Exchange winds down. A stream
   * nobody ever reads is released when the caller aborts.
   */
  function start(
    sessionId: string,
    signal: AbortSignal,
    record: () => SessionEvent
  ): { ok: true; events: AsyncGenerator<ExchangeEvent> } | { ok: false; reason: 'ended' } {
    inFlight.add(sessionId)
    const free = () => void inFlight.delete(sessionId)
    let started = false
    signal.addEventListener('abort', () => !started && free(), { once: true })

    let first: SessionEvent
    try {
      // The run boundary: NPCs that died, left or were retired since the last run drop out of the
      // stored Scene (they never resolve in the meantime), ending a dialogue with them.
      sessions.pruneScene(sessionId)
      first = record()
    } catch (error) {
      free()
      if (error instanceof SessionValidationError) return { ok: false, reason: 'ended' }
      throw error
    }

    async function* events(): AsyncGenerator<ExchangeEvent> {
      started = true
      try {
        yield { type: 'event', event: first }
        yield* run(sessionId, signal, first)
      } finally {
        free()
      }
    }
    return { ok: true, events: events() }
  }

  return {
    /** Resolves when every background Beat check and memory extraction has finished. */
    async settled(): Promise<void> {
      while (background.size) await Promise.all([...background])
    },

    /**
     * Starts an Exchange for the player's Declaration. Refusals are decided synchronously, before
     * anything is saved. The Declaration is saved before any model call, so a stopped or failed
     * Exchange keeps it.
     */
    begin(sessionId: string, declaration: string, signal: AbortSignal): BeginResult {
      const refused = refusal(sessionId)
      if (refused) return { ok: false, reason: refused }
      const text = declaration.trim()
      if (!text) return { ok: false, reason: 'empty-action' }
      if (inFlight.has(sessionId)) return { ok: false, reason: 'in-flight' }

      return start(sessionId, signal, () =>
        sessions.appendEvent(sessionId, { role: 'player', kind: 'declaration', text })
      )
    }
  }
}

export type SceneRunner = ReturnType<typeof createSceneRunner>
