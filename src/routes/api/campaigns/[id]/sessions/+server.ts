import { json } from '@sveltejs/kit'
import { library } from '#lib/server/campaign/index.ts'
import { CampaignMissingError, CampaignNotFoundError } from '#lib/server/campaign/library.ts'
import type { RequestHandler } from './$types'

/**
 * The Player's Session history: each closed Session's summary and threads, newest first. Read-only:
 * there is no route to edit a summary. 404 `{ error }` for an unknown Campaign.
 */
export const GET: RequestHandler = ({ params }) => {
  try {
    return json(library.record(params.id).sessionHistory())
  } catch (e) {
    if (e instanceof CampaignNotFoundError || e instanceof CampaignMissingError) {
      return json({ error: e.message }, { status: 404 })
    }
    throw e
  }
}
