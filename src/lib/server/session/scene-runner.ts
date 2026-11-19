/**
 * The scene runner: one player action in, a stream of pipeline events out. Code owns the loop;
 * the model is only ever a narrow step inside it (see GLOSSARY.md and docs/adr/0003).
 *
 * `begin` claims the Session, saves the player's action as a `player-action` event, then hands
 * control to a `Pipeline` over the chat port and the database-backed Scene and Event log (the
 * Director pipeline in production). `resolveRoll` does the same after code resolves a pending
 * roll. The stream ends with exactly one `done` event saying why control returned to the player.
 */
import type { SessionEvent } from '#lib/session/enums.ts'
import type { PipelineEvent } from '#lib/session/pipeline-events.ts'
import type { ChatPort } from '../ai/port.ts'
import type { BeatProgress, Steering } from '../arc/beat-progress.ts'
import type { MemoryExtraction } from '../memory/extraction.ts'
import type { RollingSummary } from '../memory/summary.ts'
import { dice as defaultDice, type Dice } from '../dice.ts'
import { SessionValidationError, type SessionService } from './service.ts'

export type { DoneReason, PipelineEvent, RunStats } from '#lib/session/pipeline-events.ts'

/** Everything a pipeline step may use. State lives in the database, never in the pipeline. */
export interface PipelineContext {
  sessionId: string
  sessions: SessionService
  port: ChatPort
  /** Aborted when the player presses Stop or disconnects. */
  signal: AbortSignal
  /** The Arc steering for the prompts, read fresh per call; null (or absent) when there is none. */
  steering?: () => Steering | null
}

/** One run after the player's action: yields pipeline events, ending with a `done`. */
export type Pipeline = (context: PipelineContext) => AsyncGenerator<PipelineEvent>

export type BeginRefusal = 'not-found' | 'ended' | 'empty-action' | 'roll-pending' | 'in-flight'

export type ResolveRefusal = 'not-found' | 'ended' | 'no-pending-roll' | 'in-flight'

export type ResolveResult =
  { ok: true; events: AsyncGenerator<PipelineEvent> } | { ok: false; reason: ResolveRefusal }

export type BeginResult =
  { ok: true; events: AsyncGenerator<PipelineEvent> } | { ok: false; reason: BeginRefusal }

export interface SceneRunnerDeps {
  sessions: SessionService
  port: ChatPort
  pipeline: Pipeline
  /** The roller for roll resolution. Defaults to the process-wide dice. */
  dice?: Dice
  /** The Character's modifier for a pending roll's check. Defaults to 0. */
  rollModifier?: (sessionId: string, check: string) => number
  /** Arc Beat-progress: steering for the prompts and the silent Beat check after each run. */
  beatProgress?: BeatProgress
  /** World memory extraction, fired in the background after each run that yields or rolls. */
  memory?: MemoryExtraction
  /** The Rolling summary, fired in the background alongside extraction. */
  summary?: RollingSummary
}

export function createSceneRunner(deps: SceneRunnerDeps) {
  const { sessions, port, pipeline, dice = defaultDice } = deps
  const rollModifier = deps.rollModifier ?? (() => 0)
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
   * Fires the silent background work over a finished run (the Beat check over this run's events,
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
    fromSeq: number
  ): AsyncGenerator<PipelineEvent> {
    let finished = false
    try {
      const steering = deps.beatProgress && (() => deps.beatProgress!.steering(sessionId))
      for await (const step of pipeline({ sessionId, sessions, port, signal, steering })) {
        yield step
        if (step.type === 'done') {
          finished = true
          if (step.reason === 'yield' || step.reason === 'roll') checkBeats(sessionId, fromSeq)
          break
        }
      }
    } catch (error) {
      if (signal.aborted) {
        yield { type: 'done', reason: 'stopped' }
      } else {
        yield {
          type: 'done',
          reason: 'error',
          message: error instanceof Error ? error.message : String(error)
        }
      }
      return
    }
    if (!finished) {
      if (!signal.aborted) checkBeats(sessionId, fromSeq)
      yield { type: 'done', reason: signal.aborted ? 'stopped' : 'yield' }
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
   * call, then streams that event and the pipeline's. The claim is held until the stream actually
   * finishes, so a stopped run cannot overlap the next one while the pipeline winds down. A stream
   * nobody ever reads is released when the caller aborts.
   */
  function start(
    sessionId: string,
    signal: AbortSignal,
    record: () => SessionEvent
  ): { ok: true; events: AsyncGenerator<PipelineEvent> } | { ok: false; reason: 'ended' } {
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

    async function* events(): AsyncGenerator<PipelineEvent> {
      started = true
      try {
        yield { type: 'event', event: first }
        yield* run(sessionId, signal, first.seq)
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
     * Starts a run for the player's action. Refusals are decided synchronously, before anything
     * is saved. The action is saved before any model call, so a stopped or failed run keeps it.
     */
    begin(sessionId: string, input: string, signal: AbortSignal): BeginResult {
      const refused = refusal(sessionId)
      if (refused) return { ok: false, reason: refused }
      const text = input.trim()
      if (!text) return { ok: false, reason: 'empty-action' }
      if (sessions.scene(sessionId).pendingRoll) return { ok: false, reason: 'roll-pending' }
      if (inFlight.has(sessionId)) return { ok: false, reason: 'in-flight' }

      return start(sessionId, signal, () =>
        sessions.appendEvent(sessionId, { role: 'player', kind: 'player-action', text })
      )
    },

    /**
     * Resolves the pending roll: code rolls the d20, adds the Character's modifier, clears the
     * pending roll and logs a `roll-resolved` event, then runs the pipeline so the outcome is
     * narrated. The model never sees a die before code has rolled it.
     */
    resolveRoll(sessionId: string, signal: AbortSignal): ResolveResult {
      const refused = refusal(sessionId)
      if (refused) return { ok: false, reason: refused }
      const scene = sessions.scene(sessionId)
      const pending = scene.pendingRoll
      if (!pending) return { ok: false, reason: 'no-pending-roll' }
      if (inFlight.has(sessionId)) return { ok: false, reason: 'in-flight' }

      return start(sessionId, signal, () => {
        const die = dice.d20()
        const modifier = rollModifier(sessionId, pending.check)
        const total = die + modifier
        const success = total >= pending.dc
        sessions.saveScene(sessionId, { ...scene, pendingRoll: null })
        const sign = modifier < 0 ? '-' : '+'
        return sessions.appendEvent(sessionId, {
          role: 'code',
          kind: 'roll-resolved',
          text: `${pending.check} check: ${die} ${sign} ${Math.abs(modifier)} = ${total} against DC ${pending.dc}: ${success ? 'success' : 'failure'}`,
          data: { check: pending.check, dc: pending.dc, die, modifier, total, success }
        })
      })
    }
  }
}

export type SceneRunner = ReturnType<typeof createSceneRunner>
