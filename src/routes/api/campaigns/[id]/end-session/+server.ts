import { json } from '@sveltejs/kit'
import { library } from '#lib/server/campaign/index.ts'
import { CampaignMissingError, CampaignNotFoundError } from '#lib/server/campaign/library.ts'
import { play } from '#lib/server/bridge/index.ts'
import { DmAwayError } from '#lib/server/play/play.ts'
import type { RequestHandler } from './$types'

/**
 * The Player presses End Session: the DM gets an `end_session` event and closes the sitting.
 * 404 `{ error }` for an unknown Campaign; 400 when archived; 409 while the DM is away.
 */
export const POST: RequestHandler = ({ params }) => {
  try {
    if (library.get(params.id)?.status === 'archived') {
      return json({ error: 'An archived Campaign cannot be played' }, { status: 400 })
    }
    play.endSession(params.id)
    return json({ ok: true })
  } catch (e) {
    if (e instanceof DmAwayError) return json({ error: e.message }, { status: 409 })
    if (e instanceof CampaignNotFoundError || e instanceof CampaignMissingError) {
      return json({ error: e.message }, { status: 404 })
    }
    throw e
  }
}
