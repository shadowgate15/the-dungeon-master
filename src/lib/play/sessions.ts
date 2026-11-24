/** One closed Session as the Player's Session history shows it. Every field is Player-safe. */
export type SessionSummary = {
  number: number
  /** When the sitting began, in real time (ms). */
  startedAt: number
  /** The in-fiction clock minutes of its first and last Events, or null if none were logged. */
  span: { from: number; to: number } | null
  summary: string
  threads: string[]
}

/** The Player's read-only Session history, newest first. Sessions with no Narration are left out. */
export type SessionHistory = { sessions: SessionSummary[] }
