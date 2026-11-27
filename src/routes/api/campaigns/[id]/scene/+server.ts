import { json } from '@sveltejs/kit'
import { play } from '#lib/server/bridge/index.ts'
import { withCampaign } from '#lib/server/campaign/http.ts'
import type { RequestHandler } from './$types'

/** The Scene as the Player's rail shows it (clock, Place, present, elsewhere), or 404 `{ error }`. */
export const GET: RequestHandler = ({ params, locals }) =>
  withCampaign(() => json(play.scene(params.id, locals.browser)))
