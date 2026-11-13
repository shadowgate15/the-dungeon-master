import type { RollRequest } from '#lib/session/enums.ts'
import { deriveTurnState } from '#lib/session/lifecycle.ts'
import { streamText, type ChatPort, type TextEvent } from '../ai/port.ts'
import { assembleContext, turnMessage, type ContextInput } from './context.ts'
import { countQuietTurns, type ArcContextArc } from '../arc/context.ts'
import { MENTION_WINDOW_TURNS, type MemoryInput } from '../memory/context.ts'
import { MAX_ROLL_REJECTIONS, parseRollRequest, ROLL_TOOL_NAME, rollTool } from './roll-request.ts'
import type { Session, SessionService, Turn } from './service.ts'
import { SUMMARY_MAX_FAILURES, summaryDue, writeSummary } from './summary.ts'
import { MEMORY_MAX_FAILURES, runExtraction, type RejectionLog } from '../memory/extraction.ts'
import type { MemoryRepository } from '../memory/repository.ts'

/**
 * The server turn-runner: plays one streamed DM turn for a Session.
 *
 * - The DM opens an empty Session; the player's action is saved before the model call.
 * - One model call in flight per Session; a second `begin` is refused.
 * - Stop (the signal aborting), a model failure and a closed tab share one path: the partial
 *   DM turn is discarded, the player turn stays unanswered, and `begin` with no action (Retry)
 *   answers it. A DM turn is saved only when the model finishes.
 * - After a saved DM turn, once unsummarized Turns pass about half the Turn budget, a separate
 *   stateless call refreshes the Session's rolling summary in the background. It never blocks
 *   or fails a turn; on any failure the summary is simply left as it was, and after
 *   `SUMMARY_MAX_FAILURES` failures in a row the Session stops trying.
 */

export const ACTION_MAX = 2000

const INVALID_ROLL_FAILURE = {
  kind: 'invalid-output',
  message: 'The Dungeon Master could not make a valid roll request. Try again.'
} as const

export interface TurnRunnerDeps {
  sessions: SessionService
  port: ChatPort
  /** The model's context window, in tokens. */
  contextLimit: number
  /** Tokens reserved for (and capped on) the DM's reply. */
  replyReserve: number
  /** Code's d20; the DM never rolls. */
  rollD20: () => number
  /** The modifier for a check, from the Character's derived stats. 0 when it cannot be derived. */
  rollModifier: (session: { characterId: string }, request: RollRequest) => number
  /** The Campaign Seed, Worlds and derived sheet text for the Session's Campaign and Character. */
  loadContext: (session: { campaignId: string; characterId: string }) => Omit<
    ContextInput,
    'turns' | 'contextLimit' | 'replyReserve' | 'arc'
  > & {
    /** The Campaign's Arc, if any; only an accepted one steers the DM. */
    arc?: ArcContextArc | null
  }
  /** World memory. Absent, the runner does no post-turn extraction. */
  memory?: MemoryRepository
  /** Where rejected extraction items are logged; defaults to the server log. */
  log?: RejectionLog
}

export type BeginRefusal = 'not-found' | 'ended' | 'in-flight' | 'invalid-state' | 'empty-action'

export type BeginResult =
  { ok: true; events: AsyncGenerator<TextEvent> } | { ok: false; reason: BeginRefusal }

export interface TurnRunner {
  /**
   * Starts a DM turn. With `action`, saves the player's action first (the Session must be
   * awaiting one); with `roll`, code rolls the d20 and saves the Roll result first (the Session
   * must have a pending Roll request); without either, the DM opens an empty Session or answers an
   * unanswered action or Roll result (Retry, which never rolls again). Refusals are decided synchronously, before anything is saved. The returned events
   * are the narration deltas, then `done` or `error`; aborting `signal` ends them with neither.
   */
  begin(
    sessionId: string,
    input: { action?: string; roll?: boolean; contextLimit?: number },
    signal: AbortSignal
  ): BeginResult
  /** Whether a model call is in flight for the Session. */
  isGenerating(sessionId: string): boolean
  /** Resolves when no background summary call is running; never rejects. For tests and shutdown. */
  summaryIdle(): Promise<void>
  /** Resolves when no background memory extraction is running; never rejects. For tests, shutdown and starting a Session. */
  memoryIdle(): Promise<void>
}

export function createTurnRunner(deps: TurnRunnerDeps): TurnRunner {
  const inFlight = new Set<string>()
  const summarizing = new Map<string, Promise<void>>()
  /** Consecutive failed summary calls per Session; at the cap the runner stops trying. */
  const summaryFailures = new Map<string, number>()

  /** Starts a background summary for the Session if one is due and none is already running. */
  function summarizeIfDue(sessionId: string, turnBudget: number) {
    if (summarizing.has(sessionId)) return
    if ((summaryFailures.get(sessionId) ?? 0) >= SUMMARY_MAX_FAILURES) return
    const current = deps.sessions.get(sessionId)
    if (!current) return
    const turns = deps.sessions.turns(sessionId)
    const unsummarized = turns.filter((t) => t.seq > current.summarizedThroughSeq)
    if (!summaryDue(unsummarized, turnBudget)) return
    const job = writeSummary(deps.port, {
      threadId: `${sessionId}:summary`,
      previous: current.summary,
      turns: unsummarized
    })
      .then((summary) => {
        if (!summary) {
          summaryFailures.set(sessionId, (summaryFailures.get(sessionId) ?? 0) + 1)
          return
        }
        summaryFailures.delete(sessionId)
        deps.sessions.saveSummary(sessionId, summary, unsummarized.at(-1)!.seq)
      })
      .catch(() => {}) // housekeeping: never surfaces
      .finally(() => summarizing.delete(sessionId))
    summarizing.set(sessionId, job)
  }

  /**
   * The World memory records and mention window for a DM call. The window is the last few Turns;
   * with none yet (the opening of a new Session) it is the previous Session's last Turns, and
   * "now" is that Session's end, so what it just established reads as recent.
   */
  /** DM turns across the Campaign's Sessions since the Arc last made Beat progress. */
  function quietTurns(arc: ArcContextArc, current: Session) {
    return countQuietTurns(
      arc,
      deps.sessions
        .listNumbered(current.campaignId)
        .map((s) => ({ id: s.id, turns: deps.sessions.turns(s.id) }))
    )
  }

  function memoryInput(current: Session, turns: readonly Turn[]): MemoryInput | undefined {
    const memory = deps.memory
    if (!memory) return undefined
    let windowTurns = turns
    let focus = { sessionId: current.id, seq: turns.at(-1)?.seq ?? 0 }
    if (turns.length === 0) {
      const all = deps.sessions.listNumbered(current.campaignId)
      const earlier = all[all.findIndex((s) => s.id === current.id) - 1]
      if (earlier) {
        windowTurns = deps.sessions.turns(earlier.id)
        focus = { sessionId: earlier.id, seq: windowTurns.at(-1)?.seq ?? 0 }
      }
    }
    return {
      ...memory.snapshot(current.campaignId, current.characterId),
      window: windowTurns.slice(-MENTION_WINDOW_TURNS).map((t) => turnMessage(t).content),
      focus
    }
  }

  const extracting = new Map<string, Promise<void>>()
  /** Consecutive failed extraction calls per Session; at the cap the runner stops trying. */
  const memoryFailures = new Map<string, number>()

  /**
   * Starts a background extraction over every Turn since the Session's watermark, unless one is
   * already running (it re-checks when it finishes, so nothing saved meanwhile is missed). Only
   * called after a DM turn was saved, so discarded, stopped and failed turns never reach it.
   */
  function extractIfDue(sessionId: string) {
    const memory = deps.memory
    if (!memory || extracting.has(sessionId)) return
    if ((memoryFailures.get(sessionId) ?? 0) >= MEMORY_MAX_FAILURES) return
    const current = deps.sessions.get(sessionId)
    if (!current) return
    const turns = deps.sessions.turns(sessionId).filter((t) => t.seq > current.memoryThroughSeq)
    // Covers up to the last DM turn: a trailing unanswered player action waits for its answer.
    const lastDm = turns.findLast((t) => t.author === 'dm')
    if (!lastDm) return
    const covered = turns.filter((t) => t.seq <= lastDm.seq)
    const job = runExtraction(
      deps.port,
      memory,
      {
        threadId: `${sessionId}:memory`,
        campaignId: current.campaignId,
        characterId: current.characterId,
        sessionId,
        turns: covered
      },
      deps.log
    )
      .then((ok) => {
        if (!ok) {
          memoryFailures.set(sessionId, (memoryFailures.get(sessionId) ?? 0) + 1)
          return false
        }
        memoryFailures.delete(sessionId)
        deps.sessions.saveMemoryThrough(sessionId, lastDm.seq)
        return true
      })
      .catch(() => false) // housekeeping: never surfaces
      .finally(() => extracting.delete(sessionId))
      .then((ok) => {
        if (ok) extractIfDue(sessionId)
      })
    extracting.set(sessionId, job)
  }

  return {
    isGenerating: (sessionId) => inFlight.has(sessionId),
    summaryIdle: async () => {
      await Promise.all(summarizing.values())
    },
    memoryIdle: async () => {
      // A finished job may start a follow-up, so wait until none is left.
      while (extracting.size > 0) await Promise.all(extracting.values())
    },

    begin(sessionId, input, signal) {
      const current = deps.sessions.get(sessionId)
      if (!current) return { ok: false, reason: 'not-found' }
      if (current.endedAt !== null) return { ok: false, reason: 'ended' }
      if (inFlight.has(sessionId)) return { ok: false, reason: 'in-flight' }

      const action = input.action?.trim()
      if (input.action !== undefined && (!action || action.length > ACTION_MAX)) {
        return { ok: false, reason: 'empty-action' }
      }
      const state = deriveTurnState(deps.sessions.turns(sessionId))
      if (input.roll && action !== undefined) return { ok: false, reason: 'invalid-state' }
      const allowed = input.roll
        ? ['pending-roll']
        : action === undefined
          ? ['unopened', 'unanswered']
          : ['awaiting-action']
      if (!allowed.includes(state)) return { ok: false, reason: 'invalid-state' }
      const pending = input.roll ? deps.sessions.turns(sessionId).at(-1)?.rollRequest : undefined

      // Claim the Session now (before anything async); the abort listener frees it even if the
      // events are never iterated, e.g. the response was cancelled before it started.
      inFlight.add(sessionId)
      const release = () => {
        inFlight.delete(sessionId)
        signal.removeEventListener('abort', release)
      }
      signal.addEventListener('abort', release, { once: true })
      if (signal.aborted) release()

      try {
        if (action !== undefined) {
          deps.sessions.appendTurn(sessionId, { author: 'player', kind: 'action', text: action })
        } else if (pending) {
          // Code rolls, and the result is saved before the model call: a failed answer keeps it.
          const d20 = deps.rollD20()
          const modifier = deps.rollModifier(current, pending)
          deps.sessions.appendTurn(sessionId, {
            author: 'player',
            kind: 'roll_result',
            rollResult: { d20, modifier, total: d20 + modifier }
          })
        }
      } catch (error) {
        release()
        throw error
      }

      async function* events(): AsyncGenerator<TextEvent> {
        try {
          const turns = deps.sessions.turns(sessionId)
          const { arc, ...loaded } = deps.loadContext(current!)
          const context = assembleContext({
            ...loaded,
            arc: arc?.status === 'accepted' ? { arc, quietTurns: quietTurns(arc, current!) } : null,
            summary: deps.sessions.get(sessionId)?.summary ?? null,
            turns,
            memory: memoryInput(current!, turns),
            contextLimit: input.contextLimit ?? deps.contextLimit,
            replyReserve: deps.replyReserve
          })
          let narration = ''
          let rollRequest: RollRequest | undefined
          let rejections = 0
          // Aborts the model call on the rejection cap; the caller's signal feeds it too.
          const call = new AbortController()
          const relay = () => call.abort()
          signal.addEventListener('abort', relay, { once: true })
          try {
            for await (const event of streamText(deps.port, {
              systemPrompts: context.systemPrompts,
              messages: context.messages,
              maxTokens: deps.replyReserve,
              threadId: sessionId,
              tools: [rollTool],
              signal: call.signal
            })) {
              if (signal.aborted) return
              if (event.type === 'delta') {
                narration += event.text
                yield event
              } else if (event.type === 'tool-rejected') {
                yield event
                if (++rejections > MAX_ROLL_REJECTIONS) {
                  call.abort()
                  yield { type: 'error', failure: INVALID_ROLL_FAILURE }
                  return
                }
              } else if (event.type === 'approval-requested') {
                if (event.toolName === ROLL_TOOL_NAME && !rollRequest) {
                  // The tool validated this already; if it still does not parse, fail rather
                  // than save the DM turn without its Roll request.
                  rollRequest = parseRollRequest(event.input)
                  if (!rollRequest) {
                    call.abort()
                    yield { type: 'error', failure: INVALID_ROLL_FAILURE }
                    return
                  }
                }
              } else if (event.type === 'done') {
                if (!narration.trim() && !rollRequest) {
                  yield {
                    type: 'error',
                    failure: { kind: 'invalid-output', message: 'The DM said nothing' }
                  }
                  return
                }
                // A Roll request ends the DM's turn and stays pending: this row is the interrupt.
                deps.sessions.appendTurn(sessionId, {
                  author: 'dm',
                  kind: 'narration',
                  text: narration.trim() ? narration : null,
                  ...(rollRequest && { rollRequest })
                })
                summarizeIfDue(sessionId, context.turnBudget)
                extractIfDue(sessionId)
                yield event
              } else {
                yield event
              }
            }
          } finally {
            signal.removeEventListener('abort', relay)
          }
        } catch (error) {
          if (signal.aborted) return
          yield {
            type: 'error',
            failure: {
              kind: 'provider-error',
              message: error instanceof Error ? error.message : 'The DM could not answer'
            }
          }
        } finally {
          release()
        }
      }
      return { ok: true, events: events() }
    }
  }
}
