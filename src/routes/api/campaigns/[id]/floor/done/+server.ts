import { json } from '@sveltejs/kit'
import { library } from '#lib/server/campaign/index.ts'
import { CampaignMissingError, CampaignNotFoundError } from '#lib/server/campaign/library.ts'
import { play } from '#lib/server/bridge/index.ts'
import { DmAwayError, DmBusyError } from '#lib/server/play/play.ts'
import type { RequestHandler } from './$types'

/**
 * The Player presses Done: `{ closed }`, true once the Floor closed and woke the DM. 409 `{ error }`
 * while the DM is still answering the last turn or is away; 404 for an unknown Campaign; 400 when archived.
 */
export const POST: RequestHandler = ({ params }) => {
  try {
    if (library.get(params.id)?.status === 'archived') {
      return json({ error: 'An archived Campaign cannot be played' }, { status: 400 })
    }
    return json({ closed: play.done(params.id).closed })
  } catch (e) {
    if (e instanceof DmBusyError || e instanceof DmAwayError)
      return json({ error: e.message }, { status: 409 })
    if (e instanceof CampaignNotFoundError || e instanceof CampaignMissingError) {
      return json({ error: e.message }, { status: 404 })
    }
    throw e
  }
}
