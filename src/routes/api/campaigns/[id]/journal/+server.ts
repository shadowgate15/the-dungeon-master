import { json } from '@sveltejs/kit'
import { play } from '#lib/server/bridge/index.ts'
import { withCampaign } from '#lib/server/campaign/http.ts'
import type { RequestHandler } from './$types'

/** The Player's Journal (their Characters' Beliefs, truth stripped), or 404 `{ error }`. */
export const GET: RequestHandler = ({ params, locals }) =>
  withCampaign(() => json(play.journal(params.id, locals.browser)))
