import { buildSummary, detailToSummaryData } from '#lib/character/summary.ts'
import type { AbilityKey } from '#lib/rules/registry.ts'
import { createCharacterService } from '../character/service.ts'
import { loadWizardRules } from '../character/wizard-rules.ts'
import type { Database } from '../db/connect'
import { session } from '../db/schema'
import { eq } from 'drizzle-orm'

/** The Character's modifier for a Check: a skill or save slug from the Exchange contract. */
export type CheckModifier = (sessionId: string, check: string) => number

/** A save slug's ability (`constitution_save` is `con`). */
const SAVE_ABILITY: Record<string, AbilityKey> = {
  strength_save: 'str',
  dexterity_save: 'dex',
  constitution_save: 'con',
  intelligence_save: 'int',
  wisdom_save: 'wis',
  charisma_save: 'cha'
}

/**
 * Looks the modifier up on the Session's Character, derived from the rules: a saving throw for a
 * save slug, a skill otherwise (the contract's `sleight_of_hand` is the rules' `sleight-of-hand`).
 * 0 when the Character or the stat cannot be read.
 */
export function createCheckModifier(db: Database): CheckModifier {
  const characters = createCharacterService(db)
  return (sessionId, check) => {
    const owner = db.select().from(session).where(eq(session.id, sessionId)).get()
    const hero = owner && characters.get(owner.characterId)
    if (!hero) return 0
    const { stats } = buildSummary(loadWizardRules(), detailToSummaryData(hero))
    const save = SAVE_ABILITY[check]
    const stat = save ? stats.savingThrows[save] : stats.skills[check.replaceAll('_', '-')]
    return stat?.status === 'ok' ? stat.value.modifier : 0
  }
}
