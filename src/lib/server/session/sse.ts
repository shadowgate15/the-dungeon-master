import { EventType, toServerSentEventsResponse, type StreamChunk } from '@tanstack/ai'
import type { TextEvent } from '../ai/port.ts'

/**
 * Maps the turn-runner's events to AG-UI chunks and sends them as TanStack AI's SSE response.
 * `abortController` is the one shared with the model call: the helper aborts it when the
 * response body is cancelled (Stop or a closed tab), which stops the provider call.
 */
async function* toChunks(events: AsyncIterable<TextEvent>, threadId: string) {
  const runId = crypto.randomUUID()
  const messageId = crypto.randomUUID()
  const base = () => ({ timestamp: Date.now() })
  yield { type: EventType.RUN_STARTED, runId, threadId, ...base() } as StreamChunk
  let started = false
  for await (const event of events) {
    if (event.type === 'delta') {
      if (!started) {
        started = true
        yield {
          type: EventType.TEXT_MESSAGE_START,
          messageId,
          role: 'assistant',
          ...base()
        } as StreamChunk
      }
      yield {
        type: EventType.TEXT_MESSAGE_CONTENT,
        messageId,
        delta: event.text,
        ...base()
      } as StreamChunk
    } else if (event.type === 'done') {
      if (started) yield { type: EventType.TEXT_MESSAGE_END, messageId, ...base() } as StreamChunk
      yield {
        type: EventType.RUN_FINISHED,
        runId,
        threadId,
        finishReason: 'stop',
        ...base()
      } as StreamChunk
    } else {
      yield {
        type: EventType.RUN_ERROR,
        message: event.failure.message,
        code: event.failure.kind,
        ...base()
      } as StreamChunk
    }
  }
}

export function turnEventsResponse(
  events: AsyncIterable<TextEvent>,
  abortController: AbortController,
  threadId: string
): Response {
  return toServerSentEventsResponse(toChunks(events, threadId), { abortController })
}
