import { json } from '@sveltejs/kit'
import type { CharacterDraft } from '#lib/character/draft.ts'
import { changeParty, readJson } from '#lib/server/character/respond.ts'
import type { RequestHandler } from './$types'

/** Replaces a saved Character's choices from the edit wizard's draft: `{ id }` or 400/404 `{ error }`. */
export const PUT: RequestHandler = async ({ params, request }) => {
  const body = await readJson<CharacterDraft>(request)
  return changeParty(params.id, body, (party) =>
    json({ id: party.updateCharacter(params.character, body!).id })
  )
}
