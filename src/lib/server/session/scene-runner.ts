/**
 * The scene runner: one player action in, a stream of pipeline events out. Code owns the loop;
 * the model is only ever a narrow step inside it (see GLOSSARY.md and docs/adr/0003).
 *
 * `begin` claims the Session, saves the player's action as a `player-action` event, then hands
 * control to a pluggable `Pipeline` over the chat port and the database-backed Scene and Event
 * log. The stream ends with exactly one `done` event saying why control returned to the player.
 *
 * How later steps plug in (#204 onward). Everything below is a new `Pipeline`, or a part of one;
 * the runner itself should not need to change:
 * - Director (#204): the pipeline loops. Per step it builds a menu from `sessions.scene(id)`,
 *   asks the Director through `collectText` on `ctx.port`, validates the pick (one retry, then a
 *   code-chosen fallback) and applies the effect. It ends with `done` of `yield`, `roll` or `cap`.
 * - Narrator and NPC voice: stream with `streamText` on `ctx.port`. Add `delta` and `discard`
 *   to `PipelineEvent`; append the finished event with `ctx.sessions.appendEvent` only on
 *   success, so a stopped or failed in-flight event is never saved (check `ctx.signal`).
 * - State changes (moves, dialogue, rolls): only code calls `ctx.sessions.saveScene`, then
 *   appends the matching `scene-changed`, `mode-changed`, `roll-requested` or `roll-resolved`
 *   event with the role that produced it.
 * - Inspector data (traces, retry, fallback and cap counters): add event variants to
 *   `PipelineEvent` (for example `thinking` and `stats`); consumers ignore variants they do not
 *   know, and nothing but `event` variants is persisted.
 * - Roll resolution: a separate entry point on this runner that clears `pendingRoll`, appends
 *   `roll-resolved`, and runs the same pipeline.
 */
import type { EventKind, Role, SessionEvent } from '#lib/session/enums.ts'
import type { ChatPort } from '../ai/port.ts'
import { dice as defaultDice, type Dice } from '../dice.ts'
import { SessionValidationError, type SessionService } from './service.ts'

/** Why control returned to the player. */
export type DoneReason = 'yield' | 'cap' | 'roll' | 'stopped' | 'error'

/** What the runner streams. `event` carries a committed Event log entry; `done` ends the run. */
export type PipelineEvent =
  | { type: 'event'; event: SessionEvent }
  /** The Director is choosing; shown as a thinking indicator until the next event, delta or done. */
  | { type: 'thinking'; role: Role }
  /** A token of the in-flight event. It is not in the log yet, and may still be discarded. */
  | { type: 'delta'; role: Role; kind: EventKind; text: string }
  /** The in-flight event was stopped or failed: drop what the deltas built. Nothing was saved. */
  | { type: 'discard' }
  | { type: 'done'; reason: DoneReason; message?: string }

/** Everything a pipeline step may use. State lives in the database, never in the pipeline. */
export interface PipelineContext {
  sessionId: string
  sessions: SessionService
  port: ChatPort
  /** Aborted when the player presses Stop or disconnects. */
  signal: AbortSignal
}

/** One run after the player's action: yields pipeline events, ending with a `done`. */
export type Pipeline = (context: PipelineContext) => AsyncGenerator<PipelineEvent>

/** The pipeline of this tracer bullet: no model step yet, control returns to the player at once. */
export const stubPipeline: Pipeline = async function* () {
  yield { type: 'done', reason: 'yield' }
}

export type BeginRefusal = 'not-found' | 'ended' | 'empty-action' | 'roll-pending' | 'in-flight'

export type ResolveRefusal = 'not-found' | 'ended' | 'no-pending-roll' | 'in-flight'

export type ResolveResult =
  { ok: true; events: AsyncGenerator<PipelineEvent> } | { ok: false; reason: ResolveRefusal }

export type BeginResult =
  { ok: true; events: AsyncGenerator<PipelineEvent> } | { ok: false; reason: BeginRefusal }

export interface SceneRunnerDeps {
  sessions: SessionService
  port: ChatPort
  /** Defaults to the stub pipeline. */
  pipeline?: Pipeline
  /** The roller for roll resolution. Defaults to the process-wide dice. */
  dice?: Dice
  /** The Character's modifier for a pending roll's check. Defaults to 0. */
  rollModifier?: (sessionId: string, check: string) => number
}

export function createSceneRunner(deps: SceneRunnerDeps) {
  const { sessions, port, pipeline = stubPipeline, dice = defaultDice } = deps
  const rollModifier = deps.rollModifier ?? (() => 0)
  // Sessions with a run in flight. Claimed synchronously in `begin`, so two quick requests cannot
  // both pass the check.
  const inFlight = new Set<string>()

  async function* run(
    sessionId: string,
    signal: AbortSignal,
    release: () => void
  ): AsyncGenerator<PipelineEvent> {
    try {
      let finished = false
      try {
        for await (const step of pipeline({ sessionId, sessions, port, signal })) {
          yield step
          if (step.type === 'done') {
            finished = true
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
      if (!finished) yield { type: 'done', reason: signal.aborted ? 'stopped' : 'yield' }
    } finally {
      release()
    }
  }

  return {
    /**
     * Starts a run for the player's action. Refusals are decided synchronously, before anything
     * is saved. The action is saved before any model call, so a stopped or failed run keeps it.
     */
    begin(sessionId: string, input: string, signal: AbortSignal): BeginResult {
      const current = sessions.get(sessionId)
      if (!current) return { ok: false, reason: 'not-found' }
      if (current.endedAt !== null) return { ok: false, reason: 'ended' }
      const text = input.trim()
      if (!text) return { ok: false, reason: 'empty-action' }
      if (sessions.scene(sessionId).pendingRoll) return { ok: false, reason: 'roll-pending' }
      if (inFlight.has(sessionId)) return { ok: false, reason: 'in-flight' }

      inFlight.add(sessionId)
      const release = () => void inFlight.delete(sessionId)
      signal.addEventListener('abort', release, { once: true })

      let action: SessionEvent
      try {
        action = sessions.appendEvent(sessionId, { role: 'player', kind: 'player-action', text })
      } catch (error) {
        release()
        if (error instanceof SessionValidationError) return { ok: false, reason: 'ended' }
        throw error
      }

      async function* events(): AsyncGenerator<PipelineEvent> {
        yield { type: 'event', event: action }
        yield* run(sessionId, signal, release)
      }
      return { ok: true, events: events() }
    },

    /**
     * Resolves the pending roll: code rolls the d20, adds the Character's modifier, clears the
     * pending roll and logs a `roll-resolved` event, then runs the pipeline so the outcome is
     * narrated. The model never sees a die before code has rolled it.
     */
    resolveRoll(sessionId: string, signal: AbortSignal): ResolveResult {
      const current = sessions.get(sessionId)
      if (!current) return { ok: false, reason: 'not-found' }
      if (current.endedAt !== null) return { ok: false, reason: 'ended' }
      const scene = sessions.scene(sessionId)
      const pending = scene.pendingRoll
      if (!pending) return { ok: false, reason: 'no-pending-roll' }
      if (inFlight.has(sessionId)) return { ok: false, reason: 'in-flight' }

      inFlight.add(sessionId)
      const release = () => void inFlight.delete(sessionId)
      signal.addEventListener('abort', release, { once: true })

      let resolved: SessionEvent
      try {
        const die = dice.d20()
        const modifier = rollModifier(sessionId, pending.check)
        const total = die + modifier
        const success = total >= pending.dc
        sessions.saveScene(sessionId, { ...scene, pendingRoll: null })
        const sign = modifier < 0 ? '-' : '+'
        resolved = sessions.appendEvent(sessionId, {
          role: 'code',
          kind: 'roll-resolved',
          text: `${pending.check} check: ${die} ${sign} ${Math.abs(modifier)} = ${total} against DC ${pending.dc}: ${success ? 'success' : 'failure'}`,
          data: { check: pending.check, dc: pending.dc, die, modifier, total, success }
        })
      } catch (error) {
        release()
        if (error instanceof SessionValidationError) return { ok: false, reason: 'ended' }
        throw error
      }

      async function* events(): AsyncGenerator<PipelineEvent> {
        yield { type: 'event', event: resolved }
        yield* run(sessionId, signal, release)
      }
      return { ok: true, events: events() }
    }
  }
}

export type SceneRunner = ReturnType<typeof createSceneRunner>
