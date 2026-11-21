import { fetchServerSentEvents } from '@tanstack/ai-client'
import { EXCHANGE_CHUNK, type ExchangeEvent } from './exchange-events.ts'

/** What to tell the player when the server refused to start an Exchange, by the reason it gave. */
const REFUSAL_MESSAGE: Record<string, string> = {
  'in-flight': 'The previous Declaration is still being answered.'
}

/** Sends a Declaration and reports each Exchange event. Resolves with an error text or null. */
export function sendAction(
  sessionId: string,
  text: string,
  onEvent: (event: ExchangeEvent) => void,
  signal?: AbortSignal
): Promise<string | null> {
  return postRun(sessionId, 'action', { text }, onEvent, signal)
}

/**
 * Starts an Exchange over TanStack AI's server-sent-events connection and passes each event
 * (the value of an `EXCHANGE_CHUNK` custom chunk) to `onEvent`. A refused start comes back as a
 * message; a dropped connection or an abort throws.
 */
async function postRun(
  sessionId: string,
  route: 'action',
  data: Record<string, unknown>,
  onEvent: (event: ExchangeEvent) => void,
  signal?: AbortSignal
): Promise<string | null> {
  let refusal: string | undefined
  const connection = fetchServerSentEvents(`/api/sessions/${sessionId}/${route}`, {
    // The connection only reports the status of a refusal; the reason is in the JSON body.
    fetchClient: async (input, init) => {
      const response = await fetch(input, init)
      if (!response.ok) {
        const body = (await response
          .clone()
          .json()
          .catch(() => null)) as { reason?: string } | null
        refusal = body?.reason ?? ''
      }
      return response
    }
  })
  try {
    for await (const chunk of connection.connect([], data, signal, {
      threadId: sessionId,
      runId: crypto.randomUUID()
    })) {
      if (chunk.type === 'CUSTOM' && chunk.name === EXCHANGE_CHUNK) {
        onEvent(chunk.value as ExchangeEvent)
      } else if (chunk.type === 'RUN_ERROR') {
        return chunk.message
      }
    }
  } catch (error) {
    if (refusal !== undefined)
      return REFUSAL_MESSAGE[refusal] ?? 'That Declaration could not be sent.'
    throw error
  }
  return null
}
