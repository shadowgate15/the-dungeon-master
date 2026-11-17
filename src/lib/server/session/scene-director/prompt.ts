import type { SessionEvent } from '#lib/session/enums.ts'

/** The Event log as plain lines for a prompt. */
export function recentLines(events: SessionEvent[]): string {
  return events
    .map((e) => (e.kind === 'player-action' ? `Player: ${e.text}` : `${e.role}: ${e.text ?? ''}`))
    .join('\n')
}
