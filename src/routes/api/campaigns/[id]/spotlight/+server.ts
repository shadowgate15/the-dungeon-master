import { json } from '@sveltejs/kit'
import { play } from '#lib/server/bridge/index.ts'
import { CampaignMissingError, CampaignNotFoundError } from '#lib/server/campaign/library.ts'
import { readJson } from '#lib/server/character/respond.ts'
import { SpotlightRefusedError } from '#lib/server/play/play.ts'
import type { RequestHandler } from './$types'

/**
 * "Cut to <Name>": asks the DM, over its channel, to move the spotlight to a Character elsewhere.
 * 204; 400 `{ error }` for a Character already in the Scene (or unknown); 404 for an unknown Campaign.
 */
export const POST: RequestHandler = async ({ params, request }) => {
  const body = await readJson<{ character: string }>(request)
  if (typeof body?.character !== 'string') {
    return json({ error: 'Name the Character to cut to' }, { status: 400 })
  }
  try {
    play.spotlight(params.id, body.character)
    return new Response(null, { status: 204 })
  } catch (e) {
    if (e instanceof SpotlightRefusedError) return json({ error: e.message }, { status: 400 })
    if (e instanceof CampaignNotFoundError || e instanceof CampaignMissingError) {
      return json({ error: e.message }, { status: 404 })
    }
    throw e
  }
}
