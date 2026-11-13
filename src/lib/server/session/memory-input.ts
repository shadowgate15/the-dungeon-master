import { MENTION_WINDOW_TURNS, type MemoryInput } from '../memory/context.ts'
import type { MemoryRepository } from '../memory/repository.ts'
import { turnMessage } from './context.ts'
import type { Session, SessionService, Turn } from './service.ts'

/**
 * The World memory records and mention window for a call about a Session. The window is the last
 * few Turns; with none yet (the opening of a new Session) it is the previous Session's last
 * Turns, and "now" is that Session's end, so what it just established reads as recent.
 */
export function memoryInputFor(
  sessions: SessionService,
  memory: MemoryRepository,
  current: Session,
  turns: readonly Turn[]
): MemoryInput {
  let windowTurns = turns
  let focus = { sessionId: current.id, seq: turns.at(-1)?.seq ?? 0 }
  if (turns.length === 0) {
    const all = sessions.listNumbered(current.campaignId)
    const earlier = all[all.findIndex((s) => s.id === current.id) - 1]
    if (earlier) {
      windowTurns = sessions.turns(earlier.id)
      focus = { sessionId: earlier.id, seq: windowTurns.at(-1)?.seq ?? 0 }
    }
  }
  return {
    ...memory.snapshot(current.campaignId, current.characterId),
    window: windowTurns.slice(-MENTION_WINDOW_TURNS).map((t) => turnMessage(t).content),
    focus
  }
}
