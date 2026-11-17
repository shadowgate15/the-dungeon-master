import { fetchServerSentEvents } from '@tanstack/ai-client'
import { PIPELINE_CHUNK, type PipelineEvent } from './pipeline-events.ts'

/** What to tell the player when the server refused to start a run, by the reason it gave. */
const REFUSAL_MESSAGE: Record<string, string> = {
  'roll-pending': 'Roll first.',
  'no-pending-roll': 'There is no roll to make.',
  'in-flight': 'The previous action is still running.'
}

/** Sends a player action and reports each pipeline event. Resolves with an error text or null. */
export function sendAction(
  sessionId: string,
  text: string,
  onEvent: (event: PipelineEvent) => void,
  signal?: AbortSignal
): Promise<string | null> {
  return postRun(sessionId, 'action', { text }, onEvent, signal)
}

/** Clicks Roll: code rolls, then the run continues and streams like an action. */
export function resolveRoll(
  sessionId: string,
  onEvent: (event: PipelineEvent) => void,
  signal?: AbortSignal
): Promise<string | null> {
  return postRun(sessionId, 'roll', {}, onEvent, signal)
}

/**
 * Starts a run over TanStack AI's server-sent-events connection and passes each pipeline event
 * (the value of a `PIPELINE_CHUNK` custom chunk) to `onEvent`. A refused start comes back as a
 * message; a dropped connection or an abort throws.
 */
async function postRun(
  sessionId: string,
  route: 'action' | 'roll',
  data: Record<string, unknown>,
  onEvent: (event: PipelineEvent) => void,
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
      if (chunk.type === 'CUSTOM' && chunk.name === PIPELINE_CHUNK) {
        onEvent(chunk.value as PipelineEvent)
      } else if (chunk.type === 'RUN_ERROR') {
        return chunk.message
      }
    }
  } catch (error) {
    if (refusal !== undefined) return REFUSAL_MESSAGE[refusal] ?? 'That action could not be sent.'
    throw error
  }
  return null
}
