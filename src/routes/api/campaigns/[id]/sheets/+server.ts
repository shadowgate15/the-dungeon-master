import { json } from '@sveltejs/kit'
import { play } from '#lib/server/bridge/index.ts'
import { withCampaign } from '#lib/server/campaign/http.ts'
import type { RequestHandler } from './$types'

/** The Party's play sheets, as the play console shows them, or 404 `{ error }`. */
export const GET: RequestHandler = ({ params, locals }) =>
  withCampaign(() => json(play.sheets(params.id, locals.browser)))
