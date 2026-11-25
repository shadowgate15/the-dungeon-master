import { json } from '@sveltejs/kit'
import { play } from '#lib/server/bridge/index.ts'
import { withCampaign } from '#lib/server/campaign/http.ts'
import type { RequestHandler } from './$types'

/** The Player's timeline (Player-safe entries only) and awaiting Narration, or 404 `{ error }`. */
export const GET: RequestHandler = ({ params }) =>
  withCampaign(() => json(play.timeline(params.id)))
