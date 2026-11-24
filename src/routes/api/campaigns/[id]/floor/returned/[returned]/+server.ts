import { changeFloor } from '#lib/server/floor/respond.ts'
import type { RequestHandler } from './$types'

/** The composer loaded a draft a cut sent back: 204, and it is no longer held. */
export const DELETE: RequestHandler = ({ params }) =>
  changeFloor(params.id, null, (floor) => {
    floor.clearReturned(params.returned)
    return new Response(null, { status: 204 })
  })
