import { json } from '@sveltejs/kit'
import { play } from '#lib/server/bridge/index.ts'
import { library } from '#lib/server/campaign/index.ts'
import { withCampaign } from '#lib/server/campaign/http.ts'
import { readJson } from '#lib/server/character/respond.ts'
import { DmAwayError } from '#lib/server/play/play.ts'
import type { RequestHandler } from './$types'

/** The creation conversation, oldest first: `{ messages }`, or 404 `{ error }`. */
export const GET: RequestHandler = ({ params }) =>
  withCampaign(() => json({ messages: library.conversation(params.id).list() }))

/** The Player writes to the DM: 201 with the message, 400 when empty, 409 while the DM is away. */
export const POST: RequestHandler = async ({ params, request }) => {
  const body = await readJson<{ text?: unknown }>(request)
  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  if (!text) return json({ error: 'Write a message first' }, { status: 400 })
  return withCampaign(
    () => json(play.converse(params.id, text), { status: 201 }),
    [[DmAwayError, 409]]
  )
}
