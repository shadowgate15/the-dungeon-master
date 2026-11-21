import type { SessionEvent } from '#lib/session/enums.ts'

/** One Event log entry as a prompt line. */
export const eventLine = (e: SessionEvent): string =>
  e.kind === 'declaration' ? `Player: ${e.text}` : `${e.role}: ${e.text ?? ''}`
