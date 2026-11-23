import type { CharacterStatus } from './enums'

/**
 * Whether a Character can act: put a Declaration on the Floor or be picked as the acting
 * Character. Dead and departed Characters can't. The one rule the sheet tabs, the composer and the
 * server all use; presence in the Scene (#328) and Unconscious (#332) join it later.
 */
export function canAct(character: { status: CharacterStatus }): boolean {
  return character.status === 'alive'
}
