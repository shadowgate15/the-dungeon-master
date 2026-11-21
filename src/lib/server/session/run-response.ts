import { EventType, toServerSentEventsResponse, type StreamChunk } from '@tanstack/ai'
import { json } from '@sveltejs/kit'
import { EXCHANGE_CHUNK, type ExchangeEvent } from '#lib/session/exchange-events.ts'
import type { RunRefusal } from './scene-runner.ts'

/** The HTTP status for each reason the runner can refuse to start an Exchange. */
const REFUSAL_STATUS: Record<RunRefusal, number> = {
  'not-found': 404,
  ended: 409,
  'in-flight': 409,
  'empty-action': 400,
  'no-open-call': 409,
  'invalid-answer': 400
}

/** A refused run: the status for the reason, and the reason as JSON for the client to show. */
export function refusalResponse(reason: RunRefusal): Response {
  return json({ reason }, { status: REFUSAL_STATUS[reason] })
}

/**
 * One run as an AG-UI stream: `RUN_STARTED`, then each Exchange event as a `CUSTOM` chunk named
 * `EXCHANGE_CHUNK` with the event as its value (the `done` event ends the run), then
 * `RUN_FINISHED`.
 */
async function* runChunks(
  threadId: string,
  events: AsyncIterable<ExchangeEvent>
): AsyncGenerator<StreamChunk> {
  const runId = crypto.randomUUID()
  yield { type: EventType.RUN_STARTED, threadId, runId, timestamp: Date.now() }
  for await (const event of events) {
    yield { type: EventType.CUSTOM, name: EXCHANGE_CHUNK, value: event, timestamp: Date.now() }
  }
  yield { type: EventType.RUN_FINISHED, threadId, runId, timestamp: Date.now() }
}

/**
 * Streams a started run to the browser with TanStack AI's server-sent-events response. When the
 * client goes away or presses Stop, the response aborts `controller`, which stops the run.
 */
export function runResponse(
  sessionId: string,
  events: AsyncIterable<ExchangeEvent>,
  controller: AbortController
): Response {
  return toServerSentEventsResponse(runChunks(sessionId, events), { abortController: controller })
}
