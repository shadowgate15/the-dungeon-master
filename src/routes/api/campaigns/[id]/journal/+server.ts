import { json } from '@sveltejs/kit'
import { library } from '#lib/server/campaign/index.ts'
import { withCampaign } from '#lib/server/campaign/http.ts'
import type { RequestHandler } from './$types'

/** The Player's Journal (their Characters' Beliefs, truth stripped), or 404 `{ error }`. */
export const GET: RequestHandler = ({ params }) =>
  withCampaign(() => json(library.record(params.id).journal()))
