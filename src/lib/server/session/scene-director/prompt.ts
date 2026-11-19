import type { SessionEvent } from '#lib/session/enums.ts'

/** One Event log entry as a prompt line. */
export const eventLine = (e: SessionEvent): string =>
  e.kind === 'player-action' ? `Player: ${e.text}` : `${e.role}: ${e.text ?? ''}`

/** The Event log as plain lines for a prompt. */
export function recentLines(events: SessionEvent[]): string {
  return events.map(eventLine).join('\n')
}
