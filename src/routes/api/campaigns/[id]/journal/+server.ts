import { json } from '@sveltejs/kit'
import { library } from '#lib/server/campaign/index.ts'
import { CampaignMissingError, CampaignNotFoundError } from '#lib/server/campaign/library.ts'
import type { RequestHandler } from './$types'

/** The Player's Journal (their Characters' Beliefs, truth stripped), or 404 `{ error }`. */
export const GET: RequestHandler = ({ params }) => {
  try {
    return json(library.record(params.id).journal())
  } catch (e) {
    if (e instanceof CampaignNotFoundError || e instanceof CampaignMissingError) {
      return json({ error: e.message }, { status: 404 })
    }
    throw e
  }
}
