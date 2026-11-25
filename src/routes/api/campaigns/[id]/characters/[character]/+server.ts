import { json } from '@sveltejs/kit'
import type { CharacterDraft } from '#lib/character/draft.ts'
import type { CharacterDetails } from '#lib/server/character/party.ts'
import { live } from '#lib/server/campaign/index.ts'
import { changeParty, readJson } from '#lib/server/character/respond.ts'
import type { RequestHandler } from './$types'

/**
 * Replaces a saved Character's choices from the edit wizard's draft: `{ id }` or 400/404 `{ error }`;
 * 409 after Begin while the DM is away (it resets play state).
 */
export const PUT: RequestHandler = async ({ params, request }) => {
  const body = await readJson<CharacterDraft>(request)
  return changeParty(params.id, body, (party) =>
    json({ id: party.updateCharacter(params.character, body!).id })
  )
}

/**
 * Edits a Character's notes, personality, appearance or backstory, leaving play state alone:
 * `{ id, version }`, 400/404 `{ error }`, or 409 for a backstory edit after Begin while the DM is away.
 */
export const PATCH: RequestHandler = async ({ params, request }) => {
  const body = await readJson<CharacterDetails>(request)
  return changeParty(params.id, body, (party) => {
    const updated = party.updateDetails(params.character, body!)
    // Every open play sheet shows the change.
    live.publish({ type: 'timeline', campaign: params.id })
    return json({ id: updated.id, version: updated.version })
  })
}
