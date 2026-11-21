import { error } from '@sveltejs/kit'
import type { CarriedEffect } from '#lib/session/call.ts'
import { sceneRunner } from '#lib/server/session/index.ts'
import { refusalResponse, runResponse } from '#lib/server/session/run-response.ts'
import type { RequestHandler } from './$types'

/**
 * Reads a clicked exit's or NPC's Effect. Anything malformed is dropped, so the Declaration runs
 * as if typed; the runner checks the rest (that the Scene still allows it).
 */
function parseEffect(value: unknown): CarriedEffect | undefined {
  if (!value || typeof value !== 'object') return undefined
  const { effect, exitId, npcId } = value as Record<string, unknown>
  if (effect === 'move' && typeof exitId === 'string') return { effect, exitId }
  if (effect === 'talk' && typeof npcId === 'string') return { effect, npcId }
  return undefined
}

/**
 * Plays one Declaration. The player's text arrives as `forwardedProps.text` of the AG-UI run
 * input, with `forwardedProps.effect` when it came from a clicked exit or NPC, and the Exchange
 * events stream back as server-sent events (see `run-response.ts`).
 */
export const POST: RequestHandler = async ({ params, request }) => {
  const body = (await request.json().catch(() => null)) as {
    forwardedProps?: { text?: unknown; effect?: unknown }
  } | null
  const text = body?.forwardedProps?.text
  if (typeof text !== 'string') error(400, 'A Declaration is required')

  const controller = new AbortController()
  const effect = parseEffect(body?.forwardedProps?.effect)
  const result = sceneRunner.begin(params.id, text, controller.signal, effect)
  if (!result.ok) return refusalResponse(result.reason)
  return runResponse(params.id, result.events, controller)
}
