import type { CharacterDetail } from '#lib/server/character/service.ts'
import { deriveStats, type DerivedStats } from '#lib/rules/derive-stats.ts'
import { resolveFeatures, type ResolvedFeatures } from '#lib/rules/resolver.ts'
import { resolverDraft, type CharacterDraft, type WizardRules } from './draft.ts'
import { equipmentRows, fixedEquipment } from './equipment.ts'

/**
 * What the Character summary shows, in slugs: the same shape for an unsaved draft (Review step)
 * and a saved Character (/characters/[id]). Every number is derived from it by `deriveStats`.
 */
export interface SummaryData {
  name: string
  alignment: string | null
  race: string | null
  subrace: string | null
  class: string | null
  subclass: string | null
  background: string | null
  customBackgroundName?: string | null
  customBackgroundFeature?: string | null
  level: number
  appearance: string
  personality: string
  ideal: string
  bond: string
  flaw: string
  backstory: string
  baseScores: CharacterDraft['baseScores']
  picks: Record<string, string[]>
  /** Owned equipment item slugs with quantities; every owned weapon gets an attack. */
  equipment?: { item: string; quantity: number }[]
  /** Spell slugs picked from the class list. */
  classSpells?: string[]
}

/** A summary ready to render: plain data, so a server load can build it and hand it over. */
export interface SummaryModel {
  data: SummaryData
  resolved: ResolvedFeatures
  stats: DerivedStats
  /** Display names for the slugs in `data` (falling back to the slug). */
  names: {
    race: string | null
    subrace: string | null
    class: string | null
    subclass: string | null
    background: string | null
    alignment: string | null
  }
  equipment: { name: string; quantity: number }[]
  spells: { name: string; level: number }[]
}

export function draftToSummaryData(rules: WizardRules, draft: CharacterDraft): SummaryData {
  // Class spells (#114) arrive with their step; the draft has no field for them yet, so they are
  // read structurally and stay absent until then.
  const extra = draft as unknown as Partial<SummaryData>
  const resolved = resolveFeatures(rules, resolverDraft(draft))
  const custom = draft.background === 'custom'
  return {
    ...draft,
    equipment: equipmentRows(rules, draft, resolved),
    classSpells: extra.classSpells,
    customBackgroundName: custom ? draft.customBackgroundName : null,
    customBackgroundFeature: custom ? draft.customBackgroundFeature : null
  }
}

export function detailToSummaryData(c: CharacterDetail): SummaryData {
  return {
    name: c.name,
    alignment: c.alignment,
    race: c.raceSlug,
    subrace: c.subraceSlug,
    class: c.classSlug,
    subclass: c.subclassSlug,
    background: c.backgroundSlug,
    customBackgroundName: c.customBackgroundName,
    customBackgroundFeature: c.customBackgroundFeature,
    level: c.level,
    appearance: c.appearance ?? '',
    personality: c.personality ?? '',
    ideal: c.ideal ?? '',
    bond: c.bond ?? '',
    flaw: c.flaw ?? '',
    backstory: c.backstory ?? '',
    baseScores: { str: c.str, dex: c.dex, con: c.con, int: c.int, wis: c.wis, cha: c.cha },
    picks: c.picks,
    equipment: c.equipment.map((e) => ({ item: e.item, quantity: e.quantity })),
    classSpells: c.classSpells
  }
}

export function buildSummary(rules: WizardRules, data: SummaryData): SummaryModel {
  const resolved = resolveFeatures(rules, {
    race: data.race,
    subrace: data.subrace,
    class: data.class,
    subclass: data.subclass,
    background: data.background,
    picks: data.picks
  })
  // Picked rows plus the fixed class items and background package, which are not stored.
  const owned = [
    ...fixedEquipment(rules, data).flatMap((f) => f.items),
    ...(data.equipment ?? [])
  ].reduce<{ item: string; quantity: number }[]>((all, e) => {
    const row = all.find((r) => r.item === e.item)
    if (row) row.quantity += e.quantity
    else all.push({ item: e.item, quantity: e.quantity })
    return all
  }, [])
  const stats = deriveStats(rules, resolved, {
    class: data.class,
    level: data.level,
    baseScores: data.baseScores,
    equipment: owned.map((e) => e.item)
  })
  const name = (list: readonly { slug: string; name: string }[], slug: string | null) =>
    slug === null ? null : (list.find((e) => e.slug === slug)?.name ?? slug)
  const spellNames = new Map(rules.spells.map((s) => [s.slug, s]))
  const spellSlugs = [
    ...resolved.grantedSpells.map((s) => s.spell),
    ...(data.classSpells ?? []),
    ...resolved.groups.filter((g) => g.kind === 'spell').flatMap((g) => g.picks)
  ]
  return {
    data,
    resolved,
    stats,
    names: {
      race: name(rules.races, data.race),
      subrace: name(rules.subraces, data.subrace),
      class: name(rules.classes, data.class),
      subclass: name(rules.subclasses, data.subclass),
      background: data.customBackgroundName || name(rules.backgrounds, data.background),
      alignment: name(rules.alignments, data.alignment)
    },
    equipment: owned.map((e) => ({
      name: name(rules.equipment, e.item) ?? e.item,
      quantity: e.quantity
    })),
    spells: [...new Set(spellSlugs)]
      .map((slug) => ({ name: spellNames.get(slug)!.name, level: spellNames.get(slug)!.level }))
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
  }
}
