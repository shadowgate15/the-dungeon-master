import { emptyDraft, type CharacterDraft } from '#lib/character/draft.ts'
import type { CampaignLibrary } from '../campaign/library'

/** A Human Fighter (Acolyte, standard array) with every wizard step answered. For tests. */
export const fighterDraft = (name: string): CharacterDraft => ({
  ...emptyDraft(),
  name,
  race: 'human',
  class: 'fighter',
  background: 'acolyte',
  abilityMethod: 'standard-array',
  baseScores: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
  picks: {
    'class/fighter/proficiency-0': ['skill-athletics', 'skill-intimidation'],
    'class/fighter/fightingStyle-0': ['fighter-fighting-style-defense'],
    'race/human/language-0': ['dwarvish'],
    'background/acolyte/language-0': ['elvish', 'halfling']
  },
  equipment: {
    ...Object.fromEntries(
      [0, 1, 2, 3].map((i) => [`class/fighter/equipment-${i}`, { option: 0, wild: [] }])
    ),
    'background/acolyte/equipment-0': { option: 0, wild: ['amulet'] }
  }
})

/** Saves a Character into the Campaign's Party through the wizard's draft flow; returns its id. */
export function addCharacter(
  library: CampaignLibrary,
  campaignId: string,
  draft: CharacterDraft
): string {
  const party = library.party(campaignId)
  const { id } = party.startDraft()
  return party.saveDraft(id, { draft, step: 'review' }).id
}
