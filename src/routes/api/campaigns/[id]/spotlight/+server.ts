import { json } from '@sveltejs/kit'
import { play } from '#lib/server/bridge/index.ts'
import { withCampaign } from '#lib/server/campaign/http.ts'
import { readJson } from '#lib/server/character/respond.ts'
import { DmAwayError, SpotlightRefusedError } from '#lib/server/play/play.ts'
import type { RequestHandler } from './$types'

/**
 * "Cut to <Name>": asks the DM, over its channel, to move the spotlight to a Character elsewhere.
 * 204; 400 `{ error }` for a Character already in the Scene (or unknown); 404 for an unknown Campaign;
 * 409 while the DM is away.
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
  const body = await readJson<{ character: string }>(request)
  if (typeof body?.character !== 'string') {
    return json({ error: 'Name the Character to cut to' }, { status: 400 })
  }
  return withCampaign(() => {
    play.spotlight(params.id, body.character, locals.browser)
    return new Response(null, { status: 204 })
  }, [
    [DmAwayError, 409],
    [SpotlightRefusedError, 400]
  ])
}
