import type { WizardRules } from '#lib/character/draft.ts'
import { armorClass } from '#lib/rules/armor-class.ts'
import type { DerivedStats } from '#lib/rules/derive-stats.ts'
import type { CharacterDetail } from './service'

/**
 * A Character's AC from its equipped armor and shield (see `armorClass`), or null while its
 * unarmored AC can't be derived yet.
 */
export function characterAc(
  rules: Pick<WizardRules, 'equipment'>,
  detail: Pick<CharacterDetail, 'inventory' | 'choices'>,
  stats: Pick<DerivedStats, 'unarmoredAc' | 'abilities'>
): { value: number; note: string } | null {
  if (stats.unarmoredAc.status !== 'ok') return null
  const dex = stats.abilities.dex
  return armorClass(rules.equipment, {
    equipped: detail.inventory.filter((i) => i.equipped).map((i) => i.item),
    dexModifier: dex.status === 'ok' ? dex.value.modifier : 0,
    unarmored: stats.unarmoredAc.value.value,
    defense: detail.choices.some((c) => c.optionSlug.endsWith('fighting-style-defense'))
  })
}
