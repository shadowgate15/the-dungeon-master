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
export function sendAction(
  sessionId: string,
  text: string,
  onMessage: (message: StreamMessage) => void,
  signal?: AbortSignal
): Promise<string | null> {
  return postStream(`/api/sessions/${sessionId}/action`, { text }, onMessage, signal)
}

/** Clicks Roll: code rolls, then the run continues and streams like an action. */
export function resolveRoll(
  sessionId: string,
  onMessage: (message: StreamMessage) => void,
  signal?: AbortSignal
): Promise<string | null> {
  return postStream(`/api/sessions/${sessionId}/roll`, {}, onMessage, signal)
}

async function postStream(
  url: string,
  payload: unknown,
  onMessage: (message: StreamMessage) => void,
  signal?: AbortSignal
): Promise<string | null> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal
  })
  if (!response.ok || !response.body) {
    const body = (await response.json().catch(() => null)) as { reason?: string } | null
    return body?.reason === 'roll-pending'
      ? 'Roll first.'
      : body?.reason === 'no-pending-roll'
        ? 'There is no roll to make.'
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
