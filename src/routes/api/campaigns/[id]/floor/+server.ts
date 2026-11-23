import { json } from '@sveltejs/kit'
import { library } from '#lib/server/campaign/index.ts'
import { CampaignMissingError, CampaignNotFoundError } from '#lib/server/campaign/library.ts'
import type { RequestHandler } from './$types'

/** The open Floor: its pending Declarations in send order, or 404 `{ error }`. */
export const GET: RequestHandler = ({ params }) => {
  try {
    return json(library.floor(params.id).current())
  } catch (e) {
    if (e instanceof CampaignNotFoundError || e instanceof CampaignMissingError) {
      return json({ error: e.message }, { status: 404 })
    }
    throw e
  }
}
