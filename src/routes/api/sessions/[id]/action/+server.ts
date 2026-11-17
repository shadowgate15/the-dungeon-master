import { error } from '@sveltejs/kit'
import { sceneRunner } from '#lib/server/session/index.ts'
import { refusalResponse, runResponse } from '#lib/server/session/run-response.ts'
import type { RequestHandler } from './$types'

/**
 * Plays one player action. The player's text arrives as `forwardedProps.text` of the AG-UI run
 * input, and the pipeline events stream back as server-sent events (see `run-response.ts`).
 */
export const POST: RequestHandler = async ({ params, request }) => {
  const body = (await request.json().catch(() => null)) as {
    forwardedProps?: { text?: unknown }
  } | null
  const text = body?.forwardedProps?.text
  if (typeof text !== 'string') error(400, 'An action is required')

  const controller = new AbortController()
  const result = sceneRunner.begin(params.id, text, controller.signal)
  if (!result.ok) return refusalResponse(result.reason)
  return runResponse(params.id, result.events, controller)
}
