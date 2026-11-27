import { play } from '#lib/server/bridge/index.ts'
import { withCampaign } from '#lib/server/campaign/http.ts'
import { CharacterNotFoundError } from '#lib/server/character/service.ts'
import { ClaimRefusedError } from '#lib/server/character/party.ts'
import { DmAwayError } from '#lib/server/play/play.ts'
import type { RequestHandler } from './$types'

/** The browser's Character departs: 204; 409 `{ error }` without the Claim or a live Session. */
export const POST: RequestHandler = ({ params, locals }) =>
  withCampaign(() => {
    play.depart(params.id, params.character, locals.browser)
    return new Response(null, { status: 204 })
  }, [
    [ClaimRefusedError, 409],
    [DmAwayError, 409],
    [CharacterNotFoundError, 404]
  ])
