import { json } from '@sveltejs/kit'
import { play } from '#lib/server/bridge/index.ts'
import { withCampaign } from '#lib/server/campaign/http.ts'
import { CharacterNotFoundError } from '#lib/server/character/service.ts'
import { ClaimRefusedError } from '#lib/server/character/party.ts'
import { readJson } from '#lib/server/character/respond.ts'
import type { RequestHandler } from './$types'

/** The Party's Claims as this browser sees them (yours, taken or free; never by whom), or 404 `{ error }`. */
export const GET: RequestHandler = ({ params, locals }) =>
  withCampaign(() => json(play.claims(params.id, locals.browser)))

/** Claims a Character for this browser: 204; 409 `{ error }` for a taken one, the Host's browser included. */
export const POST: RequestHandler = async ({ params, request, locals }) => {
  const body = await readJson<{ character: string }>(request)
  if (typeof body?.character !== 'string') {
    return json({ error: 'Name the Character to Claim' }, { status: 400 })
  }
  return withCampaign(() => {
    play.claim(params.id, body.character, locals.browser)
    return new Response(null, { status: 204 })
  }, [
    [ClaimRefusedError, 409],
    [CharacterNotFoundError, 404]
  ])
}
