import { json } from '@sveltejs/kit'
import { changeParty, readJson } from '#lib/server/character/respond.ts'
import type { DraftWrite } from '#lib/server/character/party.ts'
import type { RequestHandler } from './$types'

/**
 * Saves the stored draft into the Party: 201 `{ id }`, or 400 `{ error }` (keeping the draft)
 * while any step is not valid.
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
  const body = await readJson<DraftWrite>(request)
  return changeParty(params.id, body, (party) =>
    json({ id: party.saveDraft(params.draft, body!, locals.browser).id }, { status: 201 })
  )
}
