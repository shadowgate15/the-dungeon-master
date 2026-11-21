import { fetchServerSentEvents } from '@tanstack/ai-client'
import type { CallAnswer, CarriedEffect } from './call.ts'
import { EXCHANGE_CHUNK, type ExchangeEvent, type ExchangeRefusal } from './exchange-events.ts'

/** What to tell the player when the server refused to start an Exchange, by the reason it gave. */
const REFUSAL_MESSAGE: Record<ExchangeRefusal, string> = {
  'not-found': 'This Session no longer exists.',
  ended: 'This Session has ended.',
  'in-flight': 'The previous Declaration is still being answered.',
  'no-open-call': 'There is nothing to answer right now.',
  'invalid-answer': 'That is not one of the choices offered.',
  'empty-declaration': 'Type something first.'
}

/**
 * Sends a Declaration and reports each Exchange event. Resolves with an error text or null. A
 * clicked exit or NPC passes the Effect it carries.
 */
export function sendDeclaration(
  sessionId: string,
  text: string,
  onEvent: (event: ExchangeEvent) => void,
  signal?: AbortSignal,
  effect?: CarriedEffect
): Promise<string | null> {
  return postRun(sessionId, 'declaration', effect ? { text, effect } : { text }, onEvent, signal)
}

/**
 * Answers the open Call (a roll, where code rolls; or a choice or free text for a question) and
 * reports the rest of its Exchange's events.
 */
export function answerCall(
  sessionId: string,
  answer: CallAnswer,
  onEvent: (event: ExchangeEvent) => void,
  signal?: AbortSignal
): Promise<string | null> {
  return postRun(sessionId, 'answer', { answer }, onEvent, signal)
}

/**
 * Starts an Exchange over TanStack AI's server-sent-events connection and passes each event
 * (the value of an `EXCHANGE_CHUNK` custom chunk) to `onEvent`. A refused start comes back as a
 * message; a dropped connection or an abort throws.
 */
async function postRun(
  sessionId: string,
  route: 'declaration' | 'answer',
  data: Record<string, unknown>,
  onEvent: (event: ExchangeEvent) => void,
  signal?: AbortSignal
): Promise<string | null> {
  // Set once the server refused; the reason is absent when its body could not be read.
  let refused = false
  let refusal: ExchangeRefusal | undefined
  const connection = fetchServerSentEvents(`/api/sessions/${sessionId}/${route}`, {
    // The connection only reports the status of a refusal; the reason is in the JSON body.
    fetchClient: async (input, init) => {
      const response = await fetch(input, init)
      if (!response.ok) {
        refused = true
        const body = (await response
          .clone()
          .json()
          .catch(() => null)) as { reason?: ExchangeRefusal } | null
        refusal = body?.reason
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
    if (refused)
      return (refusal && REFUSAL_MESSAGE[refusal]) ?? 'That Declaration could not be sent.'
    throw error
  }
  return null
}
