import { sceneRunner } from '#lib/server/session/index.ts'
import { refusalResponse, runResponse } from '#lib/server/session/run-response.ts'
import type { RequestHandler } from './$types'

/**
 * Resolves the Session's pending roll: code rolls the d20, then the pipeline continues so the
 * outcome is narrated. Streams like the action route.
 */
export const POST: RequestHandler = ({ params }) => {
  const controller = new AbortController()
  const result = sceneRunner.resolveRoll(params.id, controller.signal)
  if (!result.ok) return refusalResponse(result.reason)
  return runResponse(params.id, result.events, controller)
}
