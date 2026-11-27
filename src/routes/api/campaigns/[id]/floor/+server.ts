import { json } from '@sveltejs/kit'
import { play } from '#lib/server/bridge/index.ts'
import { withCampaign } from '#lib/server/campaign/http.ts'
import type { RequestHandler } from './$types'

/** The open Floor: its pending Declarations in send order, or 404 `{ error }`. */
export const GET: RequestHandler = ({ params, locals }) =>
  withCampaign(() => json(play.openFloor(params.id, locals.browser)))
