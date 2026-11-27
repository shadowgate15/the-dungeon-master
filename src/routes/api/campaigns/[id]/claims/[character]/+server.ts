import { play } from '#lib/server/bridge/index.ts'
import { withCampaign } from '#lib/server/campaign/http.ts'
import { CharacterNotFoundError } from '#lib/server/character/service.ts'
import { ClaimRefusedError } from '#lib/server/character/party.ts'
import type { RequestHandler } from './$types'

/** Lets go of this browser's Claim on a Character: 204; 409 `{ error }` when it does not hold it. */
export const DELETE: RequestHandler = ({ params, locals }) =>
  withCampaign(() => {
    play.letGo(params.id, params.character, locals.browser)
    return new Response(null, { status: 204 })
  }, [
    [ClaimRefusedError, 409],
    [CharacterNotFoundError, 404]
  ])
