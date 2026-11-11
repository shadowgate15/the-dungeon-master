import { EventType, toServerSentEventsResponse, type StreamChunk } from '@tanstack/ai'
import type { TextEvent } from '../ai/port.ts'

/**
 * Maps the turn-runner's events to AG-UI chunks and sends them as TanStack AI's SSE response.
 * `abortController` is the one shared with the model call: the helper aborts it when the
 * response body is cancelled (Stop or a closed tab), which stops the provider call.
 *
 * The chunks are framed here rather than passed through from `chat()` because the turn-runner
 * sits between the model and the browser and owns what the client may see: `RUN_FINISHED` must
 * follow the saved DM turn (the raw one arrives before the save, and an approval interrupt also
 * ends in a `RUN_FINISHED`, which would read as a finished turn), failures are rewritten, and
 * tool-call chunks stay server-side. TanStack AI has no helper that maps filtered text events
 * back to chunks, and `toServerSentEventsResponse` still does the SSE framing and abort.
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
    } else if (event.type === 'error') {
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
