import { json } from '@sveltejs/kit'
import { db } from '#lib/server/db/index.ts'
import { createCharacterService } from '#lib/server/character/service.ts'
import { saveCharacter } from '#lib/server/character/save.ts'
import type { RequestHandler } from './$types'

const characters = createCharacterService(db)

/** Creates a Character from the wizard's draft (a `CharacterInput`): 201 `{ id }`, or 400 `{ error }`. */
export const POST: RequestHandler = async ({ request }) => {
  const result = saveCharacter(characters, await request.text())
  return 'error' in result ? json(result, { status: 400 }) : json(result, { status: 201 })
}
