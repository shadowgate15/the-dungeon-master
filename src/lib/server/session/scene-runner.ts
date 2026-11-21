/**
 * The scene runner: one Declaration in, a stream of Exchange events out. Code owns the loop; the
 * model only answers each step inside it (see GLOSSARY.md and docs/adr/0005).
 *
 * `begin` claims the Session, saves the Declaration as a `declaration` event, then runs one
 * Exchange over the chat port and the database-backed Scene and Event log. An Exchange that needs
 * a Check or a clarifying question pauses on a Call; `answerCall` rolls or answers it and runs the
 * rest. The stream ends with exactly one `done` event saying why the floor went back to the
 * player. No streamed event carries a DC.
 */
import type { CallAnswer, CarriedEffect, QuestionCall } from '#lib/session/call.ts'
import type { SceneState, SessionEvent } from '#lib/session/enums.ts'
import type { ExchangeEvent } from '#lib/session/exchange-events.ts'
import type { ChatPort } from '../ai/port.ts'
import type { BeatProgress } from '../arc/beat-progress.ts'
import { createDice, type Dice } from '../dice.ts'
import type { MemoryExtraction } from '../memory/extraction.ts'
import type { RollingSummary } from '../memory/summary.ts'
import type { CheckModifier } from './check-modifier.ts'
import { clientEvent } from './client-view.ts'
import { effectScene } from './context/ruling.ts'
import type { ContextSources } from './context/sources.ts'
import { answerCheck, answerQuestion, rollCheck, withdrawCall } from './exchange/call.ts'
import { validateEffect } from './exchange/contract.ts'
import { runExchange, type ExchangeStart } from './exchange/run.ts'
import { SessionValidationError, type SessionService } from './service.ts'

export type { DoneReason, ExchangeEvent, RunStats } from '#lib/session/exchange-events.ts'
export type { ExchangeContext } from './exchange/context.ts'

export type BeginRefusal = 'not-found' | 'ended' | 'empty-action' | 'in-flight'
export type AnswerRefusal = 'not-found' | 'ended' | 'empty-action' | 'in-flight' | 'no-open-call'
export type RunRefusal = BeginRefusal | AnswerRefusal

export type RunResult<R extends RunRefusal> =
  { ok: true; events: AsyncGenerator<ExchangeEvent> } | { ok: false; reason: R }
export type BeginResult = RunResult<BeginRefusal>
export type AnswerResult = RunResult<AnswerRefusal>

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
  /** Code's roller for Checks; unseeded when absent. */
  dice?: Dice
  /** The Character's modifier for a Check's skill or save; 0 when absent. */
  checkModifier?: CheckModifier
}

/** What a run saves before any model call, and where its Exchange then starts. */
interface Recorded {
  /** The saved events, streamed first, in order. */
  events: SessionEvent[]
  start: ExchangeStart
  /** The last event a model error keeps: the log is cut back to it and the Scene restored. */
  keepThrough: number
}

/**
 * The answer an open question takes from `answer`, or why it is refused: a roll answers only a
 * Check, a choice must be one the question offered, and free text must not be blank.
 */
function questionAnswer(
  call: QuestionCall,
  answer: CallAnswer
): { answer: string; chosen: boolean } | 'no-open-call' | 'empty-action' {
  if (answer.kind === 'roll') return 'no-open-call'
  if (answer.kind === 'choice') {
    return call.choices?.includes(answer.choice)
      ? { answer: answer.choice, chosen: true }
      : 'no-open-call'
  }
  const text = answer.text.trim()
  return text ? { answer: text, chosen: false } : 'empty-action'
}

export function createSceneRunner(deps: SceneRunnerDeps) {
  const { sessions, port } = deps
  const dice = deps.dice ?? createDice()
  const checkModifier = deps.checkModifier ?? (() => 0)
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
    start: ExchangeStart,
    before: SceneState,
    keepThrough: number
  ): AsyncGenerator<ExchangeEvent> {
    try {
      const steering = deps.beatProgress && (() => deps.beatProgress!.steering(sessionId))
      const end = yield* runExchange(
        { sessionId, sessions, port, signal, steering, context: deps.contextSources },
        start
      )
      // Only an Exchange that replied is complete: one waiting on a Call runs no background work.
      if (end === 'replied') checkBeats(sessionId, start.declaration.seq)
      yield { type: 'done', reason: end }
    } catch (error) {
      if (signal.aborted) {
        yield { type: 'done', reason: 'stopped' }
      } else {
        // A model or transport error: the Exchange never finished, so the Scene goes back to how it
        // was and the log back to `keepThrough`. A new Declaration stays; a withdrawn or answered
        // Call is restored, with its withdrawal or roll (and anything after) dropped.
        sessions.rollBack(sessionId, before, keepThrough)
        yield {
          type: 'done',
          reason: 'error',
          message: error instanceof Error ? error.message : String(error)
        }
      }
    }
  }

  /** Whether the Scene still allows a carried Effect: the exit exists, the NPC is present. */
  function allowed(sessionId: string, effect: CarriedEffect): boolean {
    return validateEffect(effectScene(sessions.scene(sessionId)), effect).ok
  }

  /** The refusals every run shares: the Session must exist and not have ended. */
  function refusal(sessionId: string): 'not-found' | 'ended' | null {
    const current = sessions.get(sessionId)
    if (!current) return 'not-found'
    return current.endedAt !== null ? 'ended' : null
  }

  /**
   * Starts a run: claims the Session, saves the run's first events (`record`) before any model
   * call, then streams those events and the Exchange's, each without its DC. The claim is held
   * until the stream actually finishes, so a stopped run cannot overlap the next one while the
   * Exchange winds down. A stream nobody ever reads is released when the caller aborts.
   */
  function start(
    sessionId: string,
    signal: AbortSignal,
    record: () => Recorded
  ): RunResult<'ended'> {
    inFlight.add(sessionId)
    const free = () => void inFlight.delete(sessionId)
    let started = false
    signal.addEventListener('abort', () => !started && free(), { once: true })

    let recorded: Recorded
    let before: SceneState
    try {
      // The run boundary: NPCs that died, left or were retired since the last run drop out of the
      // stored Scene (they never resolve in the meantime), ending a dialogue with them.
      sessions.pruneScene(sessionId)
      before = sessions.scene(sessionId)
      recorded = record()
    } catch (error) {
      free()
      if (error instanceof SessionValidationError) return { ok: false, reason: 'ended' }
      throw error
    }

    async function* events(): AsyncGenerator<ExchangeEvent> {
      started = true
      try {
        for (const event of recorded.events) yield { type: 'event', event }
        yield* run(sessionId, signal, recorded.start, before, recorded.keepThrough)
      } finally {
        free()
      }
    }
    async function* forClient(): AsyncGenerator<ExchangeEvent> {
      for await (const e of events()) {
        yield e.type === 'event' ? { type: 'event', event: clientEvent(e.event) } : e
      }
    }
    return { ok: true, events: forClient() }
  }

  return {
    /** Resolves when every background Beat check and memory extraction has finished. */
    async settled(): Promise<void> {
      while (background.size) await Promise.all([...background])
    },

    /**
     * Starts an Exchange for the player's Declaration. Refusals are decided synchronously, before
     * anything is saved. The Declaration is saved before any model call, so a stopped or failed
     * Exchange keeps it. An open Call is withdrawn first: the player chose to do something else.
     *
     * A clicked exit or NPC carries its Effect, which is applied instead of asking the Effect step
     * (still only once the Declaration happens or its Check succeeds). A carried Effect the Scene
     * no longer allows is dropped, so the Declaration runs as if typed.
     */
    begin(
      sessionId: string,
      declaration: string,
      signal: AbortSignal,
      effect?: CarriedEffect
    ): BeginResult {
      const refused = refusal(sessionId)
      if (refused) return { ok: false, reason: refused }
      const text = declaration.trim()
      if (!text) return { ok: false, reason: 'empty-action' }
      if (inFlight.has(sessionId)) return { ok: false, reason: 'in-flight' }

      return start(sessionId, signal, () => {
        const open = sessions.scene(sessionId).openCall
        const withdrawn = open ? [withdrawCall(sessions, sessionId, open)] : []
        const saved = sessions.appendEvent(sessionId, { role: 'player', kind: 'declaration', text })
        const carried = effect && allowed(sessionId, effect) ? effect : undefined
        return {
          events: [...withdrawn, saved],
          start: { kind: 'declaration', declaration: saved, ...(carried && { effect: carried }) },
          // Failing after a withdrawal undoes it too, so the Call is open again as it was.
          keepThrough: withdrawn.length ? withdrawn[0].seq - 1 : saved.seq
        }
      })
    },

    /**
     * Answers the open Call and runs the rest of its Exchange. For a roll, code rolls the d20 plus
     * the Character's modifier, logs the result and clears the Call before any model call; on
     * success the Effect runs and then the Reply, on failure the Reply narrates the failure. A
     * question takes one of its choices or free text: the answer is logged and added to the
     * history, and the Declaration is ruled on again with it.
     */
    answerCall(sessionId: string, answer: CallAnswer, signal: AbortSignal): AnswerResult {
      const refused = refusal(sessionId)
      if (refused) return { ok: false, reason: refused }
      if (inFlight.has(sessionId)) return { ok: false, reason: 'in-flight' }
      const call = sessions.scene(sessionId).openCall
      if (!call) return { ok: false, reason: 'no-open-call' }
      const declarationOf = () => {
        const declaration = sessions.events(sessionId).find((e) => e.seq === call.declaration.seq)
        if (!declaration) throw new Error('The open Call has no Declaration in the log')
        return declaration
      }
      // The Effect a click carried, unless the Scene changed under the open Call since.
      const carried = () =>
        call.effect && allowed(sessionId, call.effect) ? { effect: call.effect } : {}

      if (call.kind === 'check') {
        if (answer.kind !== 'roll') return { ok: false, reason: 'no-open-call' }
        return start(sessionId, signal, () => {
          const roll = rollCheck(call, dice, checkModifier, sessionId)
          const answered = answerCheck(sessions, sessionId, call, roll)
          return {
            events: [answered],
            start: { kind: 'check', declaration: declarationOf(), call, roll, ...carried() },
            // Failing after the roll reopens the Call, so the player can roll it again.
            keepThrough: answered.seq - 1
          }
        })
      }

      const given = questionAnswer(call, answer)
      if (typeof given === 'string') return { ok: false, reason: given }
      return start(sessionId, signal, () => {
        const { event, history } = answerQuestion(sessions, sessionId, call, given)
        return {
          events: [event],
          start: { kind: 'question', declaration: declarationOf(), history, ...carried() },
          // Failing after the answer reopens the question, so the player can answer it again.
          keepThrough: event.seq - 1
        }
      })
    }
  }
}

export type SceneRunner = ReturnType<typeof createSceneRunner>
