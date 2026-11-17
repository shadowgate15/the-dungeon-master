import type { EventKind, Role, SessionEvent } from './enums.ts'

/** Per-run counters for the event inspector. */
export interface RunStats {
  steps: number
  directorCalls: number
  retries: number
  fallbacks: number
  capHits: number
}

/** One Director step, as the event inspector shows it. */
export interface StepMessage {
  type: 'step'
  step: number
  role: Role
  menu: string[]
  pick: string
  retried: boolean
  fallback: boolean
  raw: string[]
}

/** One line of the action stream. Messages of a kind this page does not know are ignored. */
export type StreamMessage =
  | { type: 'event'; event: SessionEvent }
  | { type: 'thinking'; role: Role }
  | { type: 'delta'; role: Role; kind: EventKind; text: string; npcId?: string }
  | { type: 'discard' }
  | StepMessage
  | { type: 'stats'; stats: RunStats }
  | { type: 'done'; reason: string; message?: string }

/** Sends a player action and reports each streamed message. Resolves with an error text or null. */
export async function sendAction(
  sessionId: string,
  text: string,
  onMessage: (message: StreamMessage) => void,
  signal?: AbortSignal
): Promise<string | null> {
  const response = await fetch(`/api/sessions/${sessionId}/action`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
    signal
  })
  if (!response.ok || !response.body) {
    const body = (await response.json().catch(() => null)) as { reason?: string } | null
    return body?.reason === 'roll-pending'
      ? 'Roll first.'
      : body?.reason === 'in-flight'
        ? 'The previous action is still running.'
        : 'That action could not be sent.'
  }
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += value
    let newline: number
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline)
      buffer = buffer.slice(newline + 1)
      if (line) onMessage(JSON.parse(line) as StreamMessage)
    }
  }
  return null
}
