import { readJson } from '#lib/server/character/respond.ts'
import { changeFloor } from '#lib/server/floor/respond.ts'
import type { RequestHandler } from './$types'

/** Rewrites a pending Declaration: 204, 400 (another Player's), 400 (another Player's), or 404 `{ error }`. */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  const body = await readJson<{ text: string }>(request)
  return changeFloor(params.id, body, (floor) => {
    floor.edit(params.declaration, body!.text, locals.browser)
    return new Response(null, { status: 204 })
  })
}

/** Withdraws a pending Declaration: 204, 400 (another Player's), or 404 `{ error }`. */
export const DELETE: RequestHandler = ({ params, locals }) =>
  changeFloor(params.id, null, (floor) => {
    floor.withdraw(params.declaration, locals.browser)
    return new Response(null, { status: 204 })
  })
