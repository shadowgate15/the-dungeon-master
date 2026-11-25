import type { CharacterStatus } from './enums'

/**
 * Whether a Character can act: put a Declaration on the Floor or be picked as the acting
 * Character. Dead, departed and Unconscious Characters can't; an Unconscious one only answers
 * their own Death save Call. The one rule the sheet tabs, the composer and the server all use.
 */
export function canAct(character: { status: CharacterStatus; conditions?: string[] }): boolean {
  return character.status === 'alive' && !character.conditions?.includes('unconscious')
}
