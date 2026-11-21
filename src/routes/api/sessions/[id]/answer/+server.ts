import { error } from '@sveltejs/kit'
import type { CallAnswer } from '#lib/session/call.ts'
import { sceneRunner } from '#lib/server/session/index.ts'
import { refusalResponse, runResponse } from '#lib/server/session/run-response.ts'
import type { RequestHandler } from './$types'

/**
 * Reads the answer from the request: a roll (code rolls, so it carries nothing), a chosen choice
 * or free text. Whether it fits the open Call is the runner's to decide.
 */
function parseAnswer(value: unknown): CallAnswer | null {
  if (!value || typeof value !== 'object') return null
  const { kind, choice, text } = value as { kind?: unknown; choice?: unknown; text?: unknown }
  if (kind === 'roll') return { kind }
  if (kind === 'choice' && typeof choice === 'string') return { kind, choice }
  if (kind === 'text' && typeof text === 'string') return { kind, text }
  return null
}

/**
 * Answers the Session's open Call. The answer arrives as `forwardedProps.answer` of the AG-UI run
 * input; the rest of the Exchange streams back like the action route.
 */
export const POST: RequestHandler = async ({ params, request }) => {
  const body = (await request.json().catch(() => null)) as {
    forwardedProps?: { answer?: unknown }
  } | null
  const answer = parseAnswer(body?.forwardedProps?.answer)
  if (!answer) error(400, 'An answer is required')

  const controller = new AbortController()
  const result = sceneRunner.answerCall(params.id, answer, controller.signal)
  if (!result.ok) return refusalResponse(result.reason)
  return runResponse(params.id, result.events, controller)
}
