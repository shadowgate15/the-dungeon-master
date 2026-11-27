import { play } from '#lib/server/bridge/index.ts'
import { withCampaign } from '#lib/server/campaign/http.ts'
import { CharacterNotFoundError } from '#lib/server/character/service.ts'
import { ClaimRefusedError } from '#lib/server/character/party.ts'
import type { RequestHandler } from './$types'

/** A departed Character rejoins and this browser Claims it, session or not: 204; 409 `{ error }`. */
export const POST: RequestHandler = ({ params, locals }) =>
  withCampaign(() => {
    play.rejoin(params.id, params.character, locals.browser)
    return new Response(null, { status: 204 })
  }, [
    [ClaimRefusedError, 409],
    [CharacterNotFoundError, 404]
  ])
