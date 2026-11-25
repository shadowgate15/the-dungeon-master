import { json } from '@sveltejs/kit'
import { library } from '#lib/server/campaign/index.ts'
import { withCampaign } from '#lib/server/campaign/http.ts'
import type { RequestHandler } from './$types'

/** The open Floor: its pending Declarations in send order, or 404 `{ error }`. */
export const GET: RequestHandler = ({ params }) =>
  withCampaign(() => json(library.floor(params.id).current()))
