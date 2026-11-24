import { json } from '@sveltejs/kit'
import { play } from '#lib/server/bridge/index.ts'
import { CampaignMissingError, CampaignNotFoundError } from '#lib/server/campaign/library.ts'
import type { RequestHandler } from './$types'

/** The Scene as the Player's rail shows it (clock, Place, present, elsewhere), or 404 `{ error }`. */
export const GET: RequestHandler = ({ params }) => {
  try {
    return json(play.scene(params.id))
  } catch (e) {
    if (e instanceof CampaignNotFoundError || e instanceof CampaignMissingError) {
      return json({ error: e.message }, { status: 404 })
    }
    throw e
  }
}
