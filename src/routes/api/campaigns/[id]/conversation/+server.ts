import { json } from '@sveltejs/kit'
import { play } from '#lib/server/bridge/index.ts'
import { library } from '#lib/server/campaign/index.ts'
import { CampaignMissingError, CampaignNotFoundError } from '#lib/server/campaign/library.ts'
import { readJson } from '#lib/server/character/respond.ts'
import { DmAwayError } from '#lib/server/play/play.ts'
import type { RequestHandler } from './$types'

function notFound(e: unknown) {
  if (e instanceof CampaignNotFoundError || e instanceof CampaignMissingError) {
    return json({ error: e.message }, { status: 404 })
  }
  throw e
}

/** The creation conversation, oldest first: `{ messages }`, or 404 `{ error }`. */
export const GET: RequestHandler = ({ params }) => {
  try {
    return json({ messages: library.conversation(params.id).list() })
  } catch (e) {
    return notFound(e)
  }
}

/** The Player writes to the DM: 201 with the message, 400 when empty, 409 while the DM is away. */
export const POST: RequestHandler = async ({ params, request }) => {
  const body = await readJson<{ text?: unknown }>(request)
  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  if (!text) return json({ error: 'Write a message first' }, { status: 400 })
  try {
    return json(play.converse(params.id, text), { status: 201 })
  } catch (e) {
    if (e instanceof DmAwayError) return json({ error: e.message }, { status: 409 })
    return notFound(e)
  }
}
