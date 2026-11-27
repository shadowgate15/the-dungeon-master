import { json } from '@sveltejs/kit'
import { readJson } from '#lib/server/character/respond.ts'
import { changeFloor } from '#lib/server/floor/respond.ts'
import type { RequestHandler } from './$types'

/**
 * Sends a Declaration for one Character to the open Floor's pending tray: 201 with the
 * Declaration, or 400/404 `{ error }`.
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
  const body = await readJson<{ character: string; text: string }>(request)
  return changeFloor(params.id, body, (floor) =>
    json(floor.send({ character: body!.character, text: body!.text, player: locals.browser }), {
      status: 201
    })
  )
}
