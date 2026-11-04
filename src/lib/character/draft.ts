import type { AbilityKey, DeriveRules } from '#lib/rules/derive-stats.ts'
import { resolveFeatures, type ResolverDraft, type ResolverRules } from '#lib/rules/resolver.ts'
import type { RulesDataset } from '#lib/rules/schema.ts'

/**
 * The Character draft: the unsaved state of a Character while the wizard is open. Browser-only
 * (see GLOSSARY.md); nothing is stored until the Character is saved. Slugs everywhere, never
 * numbers, so it feeds the resolver and `deriveStats` unchanged. Later steps extend this interface
 * and `emptyDraft` with their own fields (ability rolls, equipment, spells, custom background).
 */
export interface CharacterDraft {
  // Concept: structural picks (slugs) and optional details.
  name: string
  race: string | null
  subrace: string | null
  class: string | null
  subclass: string | null
  background: string | null
  alignment: string | null
  appearance: string
  personality: string
  ideal: string
  bond: string
  flaw: string
  backstory: string
  /** Fixed at 1 in this effort; carried so `deriveStats` gets a level. */
  level: number
  // Ability scores (#110): base scores before racial bonuses; null until assigned.
  abilityMethod: 'standard-array' | 'point-buy' | 'rolling' | null
  baseScores: Record<AbilityKey, number | null>
  // Feature choices (#112): full choice key to picked option slugs.
  picks: Record<string, string[]>
}

/** The Rules Data collections the wizard reads in the browser. */
export type WizardRules = ResolverRules & DeriveRules & Pick<RulesDataset, 'alignments'>

/** The collection names a server load must hand the browser. */
export const WIZARD_RULES_KEYS = [
  'races',
  'subraces',
  'classes',
  'classLevels',
  'subclasses',
  'subclassLevels',
  'traits',
  'features',
  'backgrounds',
  'languages',
  'proficiencies',
  'spells',
  'skills',
  'equipment',
  'alignments'
] as const satisfies readonly (keyof WizardRules)[]

/** Field length limits from the data model (#91). */
export const LIMITS = {
  name: 80,
  appearance: 500,
  personality: 500,
  ideal: 500,
  bond: 500,
  flaw: 500,
  backstory: 2000
} as const

export function emptyDraft(): CharacterDraft {
  return {
    name: '',
    race: null,
    subrace: null,
    class: null,
    subclass: null,
    background: null,
    alignment: null,
    appearance: '',
    personality: '',
    ideal: '',
    bond: '',
    flaw: '',
    backstory: '',
    level: 1,
    abilityMethod: null,
    baseScores: { str: null, dex: null, con: null, int: null, wis: null, cha: null },
    picks: {}
  }
}

export const resolverDraft = (d: CharacterDraft): ResolverDraft => ({
  race: d.race,
  subrace: d.subrace,
  class: d.class,
  subclass: d.subclass,
  background: d.background,
  picks: d.picks
})

export interface Reconciled {
  draft: CharacterDraft
  /** Plain-language messages for everything that was cleared; shown above the stats strip. */
  notices: string[]
}

/**
 * Applies the wizard's change rules after any edit (#89): a structural pick that no longer fits
 * is cleared and reported, a single subclass option is selected for the player, and feature
 * choices whose group no longer exists are cleared and reported. Picks that still have a group to
 * attach to are kept (flagging them is the resolver's job). Pure; returns a new draft.
 */
export function reconcile(rules: WizardRules, input: CharacterDraft): Reconciled {
  const draft: CharacterDraft = { ...input, picks: { ...input.picks } }
  const notices: string[] = []
  const nameOf = (list: readonly { slug: string; name: string }[], slug: string) =>
    list.find((e) => e.slug === slug)?.name ?? slug

  const subrace = rules.subraces.find((s) => s.slug === draft.subrace)
  if (draft.subrace && (!subrace || subrace.race !== draft.race)) {
    notices.push(
      `Cleared the subrace ${nameOf(rules.subraces, draft.subrace)}: it no longer fits your race.`
    )
    draft.subrace = null
  }
  const subclass = rules.subclasses.find((s) => s.slug === draft.subclass)
  if (draft.subclass && (!subclass || subclass.class !== draft.class)) {
    notices.push(
      `Cleared the subclass ${nameOf(rules.subclasses, draft.subclass)}: it no longer fits your class.`
    )
    draft.subclass = null
  }

  const resolved = resolveFeatures(rules, resolverDraft(draft))
  if (!draft.subclass) {
    const only = resolved.groups.find((g) => g.kind === 'subclass')?.autoSelect
    if (only) draft.subclass = only
  }

  const owners = new Set<string>()
  for (const orphan of resolved.orphanPicks) {
    delete draft.picks[orphan.key]
    const [ownerType, ownerSlug] = orphan.key.split('/')
    const collection =
      ownerType === 'race'
        ? rules.races
        : ownerType === 'class'
          ? rules.classes
          : ownerType === 'background'
            ? rules.backgrounds
            : ownerType === 'subclass'
              ? rules.subclasses
              : rules.traits
    owners.add(nameOf(collection, ownerSlug))
  }
  for (const owner of owners) {
    notices.push(`Cleared your ${owner} choices: they no longer apply.`)
  }
  return { draft, notices }
}
