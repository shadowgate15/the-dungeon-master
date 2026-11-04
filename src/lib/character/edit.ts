import type { CharacterDetail } from '#lib/server/character/service.ts'
import { resolveFeatures } from '#lib/rules/resolver.ts'
import { emptyDraft, resolverDraft, type CharacterDraft, type WizardRules } from './draft.ts'
import { equipmentGroups, type EquipmentGroup, type EquipmentPick } from './equipment.ts'

/**
 * Turns the stored rows of one choice group back into the player's pick: the first option whose
 * fixed items are all present and whose leftover items exactly fill its wildcard slots. Null when
 * no option fits (Rules Data drift); the Equipment step then flags the group as unanswered.
 */
function pickFromRows(
  group: EquipmentGroup,
  rows: { item: string; quantity: number }[]
): EquipmentPick | null {
  for (const option of group.options) {
    const left = new Map<string, number>()
    for (const r of rows) left.set(r.item, (left.get(r.item) ?? 0) + r.quantity)
    let fits = true
    for (const line of option.lines) {
      if (line.kind !== 'item') continue
      const have = left.get(line.item) ?? 0
      if (have < line.count) fits = false
      left.set(line.item, have - line.count)
    }
    if (!fits) continue
    const wild = [...left].flatMap(([item, n]) => Array<string>(Math.max(n, 0)).fill(item))
    if (wild.length === option.slots.length) return { option: option.index, wild }
  }
  return null
}

/**
 * The wizard draft for a saved Character (#115), so the edit page reopens it prefilled. Pure
 * inverse of `draftToCharacterInput`: service vocabulary back to draft vocabulary (`roll` is
 * `rolling`, scores are `baseScores`), and stored equipment rows back to option picks.
 */
export function detailToDraft(rules: WizardRules, c: CharacterDetail): CharacterDraft {
  const draft: CharacterDraft = {
    ...emptyDraft(),
    name: c.name,
    race: c.raceSlug,
    subrace: c.subraceSlug,
    class: c.classSlug,
    subclass: c.subclassSlug,
    background: c.backgroundSlug,
    alignment: c.alignment,
    appearance: c.appearance ?? '',
    personality: c.personality ?? '',
    ideal: c.ideal ?? '',
    bond: c.bond ?? '',
    flaw: c.flaw ?? '',
    backstory: c.backstory ?? '',
    level: c.level,
    abilityMethod: c.abilityMethod === 'roll' ? 'rolling' : c.abilityMethod,
    baseScores: { str: c.str, dex: c.dex, con: c.con, int: c.int, wis: c.wis, cha: c.cha },
    abilityRolls: c.abilityRolls ?? null,
    picks: structuredClone(c.picks),
    classSpells: [...c.classSpells],
    customBackgroundName: c.customBackgroundName ?? '',
    customBackgroundFeature: c.customBackgroundFeature ?? ''
  }
  const resolved = resolveFeatures(rules, resolverDraft(draft))
  for (const group of equipmentGroups(rules, draft, resolved)) {
    const rows = c.equipment.filter((e) => e.choiceKey === group.key)
    const pick = pickFromRows(
      group,
      rows.map((e) => ({ item: e.item, quantity: e.quantity }))
    )
    if (pick) draft.equipment[group.key] = pick
  }
  return draft
}
