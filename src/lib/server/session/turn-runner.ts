import { deriveTurnState } from '#lib/session/lifecycle.ts'
import { streamText, type ChatPort, type TextEvent } from '../ai/port.ts'
import { assembleContext, type ContextInput } from './context.ts'
import type { SessionService } from './service.ts'

/**
 * The server turn-runner: plays one streamed DM turn for a Session.
 *
 * - The DM opens an empty Session; the player's action is saved before the model call.
 * - One model call in flight per Session; a second `begin` is refused.
 * - Stop (the signal aborting), a model failure and a closed tab share one path: the partial
 *   DM turn is discarded, the player turn stays unanswered, and `begin` with no action (Retry)
 *   answers it. A DM turn is saved only when the model finishes.
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
   * awaiting one); without, the DM opens an empty Session or answers an unanswered action
   * (Retry). Refusals are decided synchronously, before anything is saved. The returned events
   * are the narration deltas, then `done` or `error`; aborting `signal` ends them with neither.
   */
  begin(
    sessionId: string,
    input: { action?: string; contextLimit?: number },
    signal: AbortSignal
  ): BeginResult
  /** Whether a model call is in flight for the Session. */
  isGenerating(sessionId: string): boolean
}

export function createTurnRunner(deps: TurnRunnerDeps): TurnRunner {
  const inFlight = new Set<string>()

  return {
    isGenerating: (sessionId) => inFlight.has(sessionId),

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
      const allowed = action === undefined ? ['unopened', 'unanswered'] : ['awaiting-action']
      if (!allowed.includes(state)) return { ok: false, reason: 'invalid-state' }

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
        }
      } catch (error) {
        release()
        throw error
      }

      async function* events(): AsyncGenerator<TextEvent> {
        try {
          const context = assembleContext({
            ...deps.loadContext(current!),
            turns: deps.sessions.turns(sessionId),
            contextLimit: input.contextLimit ?? deps.contextLimit,
            replyReserve: deps.replyReserve
          })
          let narration = ''
          for await (const event of streamText(deps.port, {
            systemPrompts: context.systemPrompts,
            messages: context.messages,
            maxTokens: deps.replyReserve,
            threadId: sessionId,
            signal
          })) {
            if (signal.aborted) return
            if (event.type === 'delta') {
              narration += event.text
              yield event
            } else if (event.type === 'done') {
              if (!narration.trim()) {
                yield {
                  type: 'error',
                  failure: { kind: 'invalid-output', message: 'The DM said nothing' }
                }
                return
              }
              deps.sessions.appendTurn(sessionId, {
                author: 'dm',
                kind: 'narration',
                text: narration
              })
              yield event
            } else {
              yield event
            }
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
