import { json } from '@sveltejs/kit'
import { play } from '#lib/server/bridge/index.ts'
import { library } from '#lib/server/campaign/index.ts'
import { assertPlayable, withCampaign } from '#lib/server/campaign/http.ts'
import { CallClosedError, CallRefusedError } from '#lib/server/play/calls.ts'
import { DmAwayError } from '#lib/server/play/play.ts'
import type { RequestHandler } from './$types'

/**
 * The Player answers one part of the open Call: `{ roll: true }` rolls a Check in code,
 * `{ answer }` answers a question. Returns `{ complete }`, true once the whole Call is answered and
 * the DM is woken. 409 `{ error }` when the Call is no longer open or the DM is away; 400 for a refused answer or an
 * archived Campaign; 404 for an unknown Campaign.
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
  const body = (await request.json().catch(() => undefined)) as
    { roll?: unknown; answer?: unknown } | undefined
  if (!body || (body.roll !== true && typeof body.answer !== 'string')) {
    return json({ error: 'Send { roll: true } or { answer }' }, { status: 400 })
  }
  return withCampaign(() => {
    assertPlayable(library, params.id)
    const outcome =
      body.roll === true
        ? play.roll(params.id, params.call, params.part, locals.browser)
        : play.answer(params.id, params.call, params.part, body.answer as string, locals.browser)
    return json(outcome)
  }, [
    [CallClosedError, 409],
    [DmAwayError, 409],
    [CallRefusedError, 400]
  ])
}
