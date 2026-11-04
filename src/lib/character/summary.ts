import type { CharacterDetail } from '#lib/server/character/service.ts'
import { deriveStats, type DerivedStats } from '#lib/rules/derive-stats.ts'
import { resolveFeatures, type ResolvedFeatures } from '#lib/rules/resolver.ts'
import type { CharacterDraft, WizardRules } from './draft.ts'

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

export function draftToSummaryData(draft: CharacterDraft): SummaryData {
  // Fields later steps add to the draft (equipment #113, class spells #114, custom background)
  // are read structurally so this stays correct as they land.
  const extra = draft as unknown as Partial<SummaryData> & {
    equipment?: { item: string; quantity?: number }[]
  }
  return {
    ...draft,
    equipment: extra.equipment?.map((e) => ({ item: e.item, quantity: e.quantity ?? 1 })),
    classSpells: extra.classSpells,
    customBackgroundName: extra.customBackgroundName,
    customBackgroundFeature: extra.customBackgroundFeature
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
  const stats = deriveStats(rules, resolved, {
    class: data.class,
    level: data.level,
    baseScores: data.baseScores,
    equipment: data.equipment?.map((e) => e.item)
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
    equipment: (data.equipment ?? []).map((e) => ({
      name: name(rules.equipment, e.item) ?? e.item,
      quantity: e.quantity
    })),
    spells: [...new Set(spellSlugs)]
      .map((slug) => ({ name: spellNames.get(slug)!.name, level: spellNames.get(slug)!.level }))
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
  }
}
