import { json } from '@sveltejs/kit'
import { library } from '#lib/server/campaign/index.ts'
import { withCampaign } from '#lib/server/campaign/http.ts'
import type { RequestHandler } from './$types'

/**
 * The Player's Session history: each closed Session's summary and threads, newest first. Read-only:
 * there is no route to edit a summary. 404 `{ error }` for an unknown Campaign.
 */
export const GET: RequestHandler = ({ params }) =>
  withCampaign(() => json(library.record(params.id).sessionHistory()))
