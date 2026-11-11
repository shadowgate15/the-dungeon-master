import type { RollRequest } from '#lib/session/enums.ts'
import { deriveTurnState } from '#lib/session/lifecycle.ts'
import { streamText, type ChatPort, type TextEvent } from '../ai/port.ts'
import { assembleContext, type ContextInput } from './context.ts'
import { MAX_ROLL_REJECTIONS, parseRollRequest, ROLL_TOOL_NAME, rollTool } from './roll-request.ts'
import type { SessionService } from './service.ts'
import { summaryDue, writeSummary } from './summary.ts'

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
 *   or fails a turn; on any failure the summary is simply left as it was.
 */

export const ACTION_MAX = 2000

export interface TurnRunnerDeps {
  sessions: SessionService
  port: ChatPort
  /** The model's context window, in tokens. */
  contextLimit: number
  /** Tokens reserved for (and capped on) the DM's reply. */
  replyReserve: number
  /** The Campaign Seed, Worlds and derived sheet text for the Session's Campaign and Character. */
  /** Code's d20; the DM never rolls. */
  rollD20: () => number
  /** The modifier for a check, from the Character's derived stats. 0 when it cannot be derived. */
  rollModifier: (session: { characterId: string }, request: RollRequest) => number
  loadContext: (session: {
    campaignId: string
    characterId: string
  }) => Omit<ContextInput, 'turns' | 'contextLimit' | 'replyReserve'>
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
}

export function createTurnRunner(deps: TurnRunnerDeps): TurnRunner {
  const inFlight = new Set<string>()
  const summarizing = new Map<string, Promise<void>>()

  /** Starts a background summary for the Session if one is due and none is already running. */
  function summarizeIfDue(sessionId: string, turnBudget: number) {
    if (summarizing.has(sessionId)) return
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
        if (summary) deps.sessions.saveSummary(sessionId, summary, unsummarized.at(-1)!.seq)
      })
      .catch(() => {}) // housekeeping: never surfaces
      .finally(() => summarizing.delete(sessionId))
    summarizing.set(sessionId, job)
  }

  return {
    isGenerating: (sessionId) => inFlight.has(sessionId),
    summaryIdle: async () => {
      await Promise.all(summarizing.values())
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
          const context = assembleContext({
            ...deps.loadContext(current!),
            summary: deps.sessions.get(sessionId)?.summary ?? null,
            turns: deps.sessions.turns(sessionId),
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
                  yield {
                    type: 'error',
                    failure: {
                      kind: 'invalid-output',
                      message: 'The Dungeon Master could not make a valid roll request. Try again.'
                    }
                  }
                  return
                }
              } else if (event.type === 'approval-requested') {
                if (event.toolName === ROLL_TOOL_NAME) rollRequest ??= parseRollRequest(event.input)
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
