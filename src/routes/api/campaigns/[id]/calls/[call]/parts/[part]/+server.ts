import { json } from '@sveltejs/kit'
import { play } from '#lib/server/bridge/index.ts'
import { library } from '#lib/server/campaign/index.ts'
import { CampaignMissingError, CampaignNotFoundError } from '#lib/server/campaign/library.ts'
import { CallClosedError, CallRefusedError } from '#lib/server/play/calls.ts'
import type { RequestHandler } from './$types'

/**
 * The Player answers one part of the open Call: `{ roll: true }` rolls a Check in code,
 * `{ answer }` answers a question. Returns `{ complete }`, true once the whole Call is answered and
 * the DM is woken. 409 `{ error }` when the Call is no longer open; 400 for a refused answer or an
 * archived Campaign; 404 for an unknown Campaign.
 */
export const POST: RequestHandler = async ({ params, request }) => {
  const body = (await request.json().catch(() => undefined)) as
    { roll?: unknown; answer?: unknown } | undefined
  if (!body || (body.roll !== true && typeof body.answer !== 'string')) {
    return json({ error: 'Send { roll: true } or { answer }' }, { status: 400 })
  }
  try {
    if (library.get(params.id)?.status === 'archived') {
      return json({ error: 'An archived Campaign cannot be played' }, { status: 400 })
    }
    const outcome =
      body.roll === true
        ? play.roll(params.id, params.call, params.part)
        : play.answer(params.id, params.call, params.part, body.answer as string)
    return json(outcome)
  } catch (e) {
    if (e instanceof CallClosedError) return json({ error: e.message }, { status: 409 })
    if (e instanceof CallRefusedError) return json({ error: e.message }, { status: 400 })
    if (e instanceof CampaignNotFoundError || e instanceof CampaignMissingError) {
      return json({ error: e.message }, { status: 404 })
    }
    throw e
  }
}
