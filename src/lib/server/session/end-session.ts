/**
 * Ending a Session. The call waits (at most `DRAIN_MS`) for a running extraction, marks the
 * Session ended and lifts any extraction pause, then returns. The final extraction and the final
 * summary run afterwards in the background, best-effort: they never block the caller or the next
 * Session, and whatever they write lands on the ended Session for the following one to pick up.
 */
import type { ChatPort } from '../ai/port.ts'
import type { MemoryExtraction } from '../memory/extraction.ts'
import type { RollingSummary } from '../memory/summary.ts'
import type { Session, SessionService } from './service.ts'

/** The longest the end waits for a running extraction. */
export const DRAIN_MS = 30_000

export interface SessionEndDeps {
  sessions: SessionService
  memory: MemoryExtraction
  summary: RollingSummary
  port: ChatPort
  drainMs?: number
  /** Where a failed background step is reported. Defaults to the console. */
  log?: (message: string) => void
}

export function createSessionEnd(deps: SessionEndDeps) {
  const { sessions, memory, summary, port } = deps
  const log = deps.log ?? ((message: string) => console.warn(message))
  const background = new Set<Promise<void>>()

  /** Final extraction (even if paused), then the final summary; never throws. */
  async function finalize(sessionId: string): Promise<void> {
    try {
      await memory.extract(sessionId, port, { force: true })
      await summary.summarize(sessionId, port)
    } catch (error) {
      log(`Final memory work failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return {
    /** Ends the Session; resolves once it is marked ended, with the background work still going. */
    async end(sessionId: string): Promise<Session> {
      await memory.drain(sessionId, deps.drainMs ?? DRAIN_MS)
      const ended = sessions.end(sessionId)
      memory.resume(sessionId)
      const task = finalize(sessionId)
      background.add(task)
      void task.finally(() => background.delete(task))
      return ended
    },

    /** Resolves when the background final extraction and summary have finished. */
    async settled(): Promise<void> {
      while (background.size) await Promise.all([...background])
    }
  }
}

export type SessionEnd = ReturnType<typeof createSessionEnd>
