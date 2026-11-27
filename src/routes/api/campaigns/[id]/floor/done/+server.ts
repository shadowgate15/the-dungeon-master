import { json } from '@sveltejs/kit'
import { library } from '#lib/server/campaign/index.ts'
import { assertPlayable, withCampaign } from '#lib/server/campaign/http.ts'
import { play } from '#lib/server/bridge/index.ts'
import { DmAwayError, DmBusyError } from '#lib/server/play/play.ts'
import type { RequestHandler } from './$types'

/**
 * The Player presses Done: `{ closed }`, true once the Floor closed and woke the DM. 409 `{ error }`
 * while the DM is still answering the last turn or is away; 404 for an unknown Campaign; 400 when archived.
 */
export const POST: RequestHandler = ({ params, locals }) =>
  withCampaign(() => {
    assertPlayable(library, params.id)
    return json({ closed: play.done(params.id, locals.browser).closed })
  }, [
    [DmBusyError, 409],
    [DmAwayError, 409]
  ])

/** Not done yet: the Player takes Done back until the Floor closes. 409 `{ error }` while the DM is away. */
export const DELETE: RequestHandler = ({ params, locals }) =>
  withCampaign(() => {
    assertPlayable(library, params.id)
    play.undone(params.id, locals.browser)
    return json({})
  }, [[DmAwayError, 409]])
