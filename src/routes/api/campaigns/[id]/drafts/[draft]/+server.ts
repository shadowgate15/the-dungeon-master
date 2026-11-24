import { json } from '@sveltejs/kit'
import { library } from '#lib/server/campaign/index.ts'
import { CampaignMissingError, CampaignNotFoundError } from '#lib/server/campaign/library.ts'
import { DraftNotFoundError } from '#lib/server/character/party.ts'
import { changeParty, readJson } from '#lib/server/character/respond.ts'
import type { DraftWrite } from '#lib/server/character/party.ts'
import type { DraftWithMarks } from '#lib/creation/conversation.ts'
import type { RequestHandler } from './$types'

/** The stored draft with its version and the fields the DM set: 200, or 404 `{ error }`. */
export const GET: RequestHandler = ({ params }) => {
  try {
    const { draft, version, dmFields } = library.party(params.id).draft(params.draft)
    const body: DraftWithMarks = { draft, version, dmFields }
    return json(body)
  } catch (e) {
    if (
      e instanceof CampaignNotFoundError ||
      e instanceof CampaignMissingError ||
      e instanceof DraftNotFoundError
    ) {
      return json({ error: e.message }, { status: 404 })
    }
    throw e
  }
}

/** Writes the stored draft and the step it is on: 204, or 400/404 `{ error }`. */
export const PUT: RequestHandler = async ({ params, request }) => {
  const body = await readJson<DraftWrite>(request)
  return changeParty(params.id, body, (party) => {
    party.writeDraft(params.draft, body!)
    return new Response(null, { status: 204 })
  })
}

/** Discards the stored draft: 204, or 400/404 `{ error }`. */
export const DELETE: RequestHandler = ({ params }) =>
  changeParty(params.id, null, (party) => {
    party.discardDraft(params.draft)
    return new Response(null, { status: 204 })
  })
