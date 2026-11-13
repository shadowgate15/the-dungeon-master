import { deriveTurnState } from '#lib/session/lifecycle.ts'
import { collectText, type ChatPort } from '../ai/port.ts'
import { buildMemoryBlock } from '../memory/context.ts'
import type { MemoryRepository } from '../memory/repository.ts'
import { newestFitting, transcriptLine } from './context.ts'
import { memoryInputFor } from './memory-input.ts'
import type { SessionService } from './service.ts'

/**
 * The resume recap: a stateless side call that tells a returning player where they left off,
 * from the rolling summary and the recent Turns. It is not a Turn and is never saved to the
 * database; the text is only cached in memory per Session and last Turn number. Every failure
 * (and an abort) reads as no recap.
 */

export const RECAP_MAX_TOKENS = 300
export const RECAP_TIMEOUT_MS = 60_000
/** The most tokens of recent Turns the recap prompt may carry. */
export const RECAP_TURN_BUDGET = 2000
/** The most tokens of World memory the recap prompt may carry. */
export const RECAP_MEMORY_BUDGET = 500

export const RECAP_INSTRUCTIONS = `You are the Dungeon Master of a solo Dungeons & Dragons game, welcoming the player back after a break.
In two or three sentences, in the second person, remind them where their Character is and what was just happening, from the notes and the latest transcript below. Do not advance the story, do not ask for dice rolls and never invent numbers or game state.
Reply with the recap text only.`

export interface RecapDeps {
  sessions: SessionService
  port: ChatPort
  /** World memory for the recap; without it, or with nothing recorded, the prompt is unchanged. */
  memory?: MemoryRepository
}

export function createRecap(deps: RecapDeps) {
  const cache = new Map<string, { seq: number; text: string }>()

  return {
    /** The recap text, or `undefined` when there is none (wrong state, an ended Session, failure or abort). */
    async get(sessionId: string, signal: AbortSignal): Promise<string | undefined> {
      const found = deps.sessions.get(sessionId)
      const turns = deps.sessions.turns(sessionId)
      const last = turns.at(-1)
      if (!found || found.endedAt !== null || !last || deriveTurnState(turns) !== 'awaiting-action')
        return undefined
      const cached = cache.get(sessionId)
      if (cached?.seq === last.seq) return cached.text

      const kept = newestFitting(turns, RECAP_TURN_BUDGET).map(transcriptLine)
      const notes = found.summary?.trim()
        ? `Notes so far:\n${found.summary.trim()}`
        : 'Notes so far: none.'

      const memoryBlock = deps.memory
        ? buildMemoryBlock(
            memoryInputFor(deps.sessions, deps.memory, found, turns),
            RECAP_MEMORY_BUDGET
          )
        : null

      // Our own controller: the caller's abort and a timeout both stop the model call.
      const controller = new AbortController()
      const abort = () => controller.abort()
      if (signal.aborted) abort()
      else signal.addEventListener('abort', abort, { once: true })
      const timer = setTimeout(abort, RECAP_TIMEOUT_MS)
      try {
        const recap = await collectText(deps.port, {
          systemPrompts: [RECAP_INSTRUCTIONS, ...(memoryBlock ? [memoryBlock] : [])],
          messages: [
            { role: 'user', content: `${notes}\n\nLatest transcript:\n${kept.join('\n\n')}` }
          ],
          maxTokens: RECAP_MAX_TOKENS,
          threadId: `${sessionId}:recap`,
          signal: controller.signal
        })
        if (!recap || controller.signal.aborted) return undefined
        cache.set(sessionId, { seq: last.seq, text: recap })
        return recap
      } catch {
        return undefined
      } finally {
        clearTimeout(timer)
        signal.removeEventListener('abort', abort)
      }
    }
  }
}

export type Recap = ReturnType<typeof createRecap>
