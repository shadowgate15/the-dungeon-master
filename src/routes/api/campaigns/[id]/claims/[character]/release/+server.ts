import { play } from '#lib/server/bridge/index.ts'
import { withCampaign } from '#lib/server/campaign/http.ts'
import { CharacterNotFoundError } from '#lib/server/character/service.ts'
import { ClaimRefusedError } from '#lib/server/character/party.ts'
import type { RequestHandler } from './$types'

/** The Host frees a Character another browser holds: 204; 409 `{ error }` for any other browser. */
export const POST: RequestHandler = ({ params, locals }) =>
  withCampaign(() => {
    play.release(params.id, params.character, locals.browser)
    return new Response(null, { status: 204 })
  }, [
    [ClaimRefusedError, 409],
    [CharacterNotFoundError, 404]
  ])
