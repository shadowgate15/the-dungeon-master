import { changeParty, readJson } from '#lib/server/character/respond.ts'
import type { DraftWrite } from '#lib/server/character/party.ts'
import type { RequestHandler } from './$types'

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
