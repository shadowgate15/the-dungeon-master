import { json } from '@sveltejs/kit'
import { db } from '#lib/server/db/index.ts'
import { createCharacterService } from '#lib/server/character/service.ts'
import { updateCharacter } from '#lib/server/character/save.ts'
import type { RequestHandler } from './$types'

const characters = createCharacterService(db)

/** Replaces a saved Character from the edit wizard's draft: 200 `{ id }`, or 400 `{ error }`. */
export const PUT: RequestHandler = async ({ params, request }) => {
  const result = updateCharacter(characters, params.id, await request.text())
  return 'error' in result ? json(result, { status: 400 }) : json(result)
}
