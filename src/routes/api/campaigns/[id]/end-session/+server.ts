import { json } from '@sveltejs/kit'
import { library } from '#lib/server/campaign/index.ts'
import { assertPlayable, withCampaign } from '#lib/server/campaign/http.ts'
import { play } from '#lib/server/bridge/index.ts'
import { DmAwayError } from '#lib/server/play/play.ts'
import type { RequestHandler } from './$types'

/**
 * The Player presses End Session: the DM gets an `end_session` event and closes the Session.
 * 404 `{ error }` for an unknown Campaign; 400 when archived; 409 while the DM is away.
 */
export const POST: RequestHandler = ({ params }) =>
  withCampaign(() => {
    assertPlayable(library, params.id)
    play.endSession(params.id)
    return json({ ok: true })
  }, [[DmAwayError, 409]])
