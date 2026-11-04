import type { CharacterInput } from '#lib/server/character/service.ts'
import { ABILITY_KEYS } from '#lib/rules/derive-stats.ts'
import type { Alignment } from './enums.ts'
import type { CharacterDraft } from './draft.ts'

/**
 * Maps the wizard draft to the service's `CharacterInput`. Vocabulary differences live here:
 * draft `rolling` is service `roll`, draft `baseScores` is service `scores`. Throws when the draft
 * is incomplete (Review is only reachable when it is not). Steps that add draft fields (roll dice
 * #110, equipment #113, class spells #114, custom background) extend this mapper.
 */
export function draftToCharacterInput(draft: CharacterDraft): CharacterInput {
  const need = <T>(label: string, value: T | null): T => {
    if (value === null) throw new Error(`The draft has no ${label}`)
    return value
  }
  const scores = {} as CharacterInput['scores']
  for (const key of ABILITY_KEYS) scores[key] = need(`${key} score`, draft.baseScores[key])
  const method = need('ability method', draft.abilityMethod)
  // #110 adds the rolled dice to the draft; the service requires them for the roll method.
  const rolls = (draft as { abilityRolls?: number[][] | null }).abilityRolls
  return {
    name: draft.name,
    alignment: draft.alignment as Alignment | null,
    appearance: draft.appearance,
    personality: draft.personality,
    ideal: draft.ideal,
    bond: draft.bond,
    flaw: draft.flaw,
    backstory: draft.backstory,
    race: need('race', draft.race),
    subrace: draft.subrace,
    class: need('class', draft.class),
    subclass: draft.subclass,
    background: need('background', draft.background),
    abilityMethod: method === 'rolling' ? 'roll' : method,
    scores,
    ...(rolls ? { abilityRolls: rolls } : {}),
    picks: draft.picks
  }
}
