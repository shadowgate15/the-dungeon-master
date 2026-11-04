import {
  CharacterNotFoundError,
  CharacterValidationError,
  type CharacterInput,
  type CharacterService
} from './service.ts'

const UNREADABLE = { error: 'The Character could not be read. Try saving again.' }

function parse(payload: string): CharacterInput | undefined {
  try {
    return JSON.parse(payload)
  } catch {
    return undefined
  }
}

/**
 * Creates a Character from the wizard's JSON payload (a `CharacterInput`). The service owns
 * validation; a broken rule comes back as a message so the wizard keeps the draft and shows it.
 */
export function saveCharacter(
  service: CharacterService,
  payload: string
): { id: string } | { error: string } {
  const input = parse(payload)
  if (!input) return UNREADABLE
  try {
    return { id: service.create(input).id }
  } catch (e) {
    if (e instanceof CharacterValidationError) return { error: e.message }
    throw e
  }
}

/**
 * Replaces a saved Character from the edit wizard's payload. Same contract as `saveCharacter`;
 * a missing or archived Character comes back as a message too.
 */
export function updateCharacter(
  service: CharacterService,
  id: string,
  payload: string
): { id: string } | { error: string } {
  const input = parse(payload)
  if (!input) return UNREADABLE
  try {
    return { id: service.update(id, input).id }
  } catch (e) {
    if (e instanceof CharacterValidationError || e instanceof CharacterNotFoundError) {
      return { error: e.message }
    }
    throw e
  }
}
