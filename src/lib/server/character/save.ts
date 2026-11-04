import { CharacterValidationError, type CharacterService } from './service.ts'

/**
 * Creates a Character from the wizard's JSON payload (a `CharacterInput`). The service owns
 * validation; a broken rule comes back as a message so the wizard keeps the draft and shows it.
 */
export function saveCharacter(
  service: CharacterService,
  payload: string
): { id: string } | { error: string } {
  let input
  try {
    input = JSON.parse(payload)
  } catch {
    return { error: 'The Character could not be read. Try saving again.' }
  }
  try {
    return { id: service.create(input).id }
  } catch (e) {
    if (e instanceof CharacterValidationError) return { error: e.message }
    throw e
  }
}
