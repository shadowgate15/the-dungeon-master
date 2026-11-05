import type { GrantedSpell, ResolvedGroup } from '#lib/rules/resolver.ts'
import type { CharacterDraft, WizardRules } from './draft.ts'
import { groupIssues, type StepContext, type StepValidation } from './steps.ts'

/**
 * Class spell picks (#114, decided in #97). Cantrips for every caster; level 1 spells for Bard,
 * Sorcerer and Warlock (their `spellsKnown`) and the Wizard's six-spell spellbook. Cleric, Druid
 * and Wizard prepare spells, which are derived (`stats.spellcasting.preparedCount`), never picked.
 * The draft keeps the picks as spell slugs in `classSpells`; the High Elf cantrip is not one of
 * them (it is a resolver choice group in `draft.picks`) and granted spells are never stored.
 * Pure: no Svelte, no browser APIs.
 */

/** The Wizard's spellbook at level 1 (SRD p.114); the class table has no number for it. */
export const WIZARD_SPELLBOOK_SIZE = 6

type SpellRules = Pick<WizardRules, 'classes' | 'classLevels' | 'spells'>

export interface SpellAllowance {
  /** Exact number of cantrips to pick. */
  cantrips: number
  /** Exact number of level 1 spells to pick (spellbook size for the Wizard). */
  spells: number
}

/** How many cantrips and level 1 spells a class picks at level 1; zeros for no class or a non-caster. */
export function spellAllowance(rules: SpellRules, classSlug: string | null): SpellAllowance {
  const sc = rules.classLevels.find((l) => l.class === classSlug && l.level === 1)?.spellcasting
  return {
    cantrips: sc?.cantripsKnown ?? 0,
    spells: sc?.spellsKnown ?? (classSlug === 'wizard' ? WIZARD_SPELLBOOK_SIZE : 0)
  }
}

export interface SpellOption {
  slug: string
  name: string
}

/** Spells of one level on a class's list, by name. */
export function classSpellOptions(
  rules: Pick<WizardRules, 'spells'>,
  classSlug: string | null,
  level: 0 | 1
): SpellOption[] {
  if (!classSlug) return []
  return rules.spells
    .filter((s) => s.level === level && s.classes.includes(classSlug))
    .map((s) => ({ slug: s.slug, name: s.name }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** The High Elf cantrip group, or any other racial spell choice: resolver groups of kind `spell`. */
export const spellGroups = (ctx: Pick<StepContext, 'resolved'>): ResolvedGroup[] =>
  ctx.resolved.groups.filter((g) => g.kind === 'spell')

/** Slugs already taken by a granted spell or a spell choice group, which class picks must not repeat. */
function takenElsewhere(ctx: Pick<StepContext, 'resolved'>): Set<string> {
  return new Set([
    ...ctx.resolved.grantedSpells.map((s) => s.spell),
    ...spellGroups(ctx).flatMap((g) => g.picks)
  ])
}

export interface PickFlag {
  slug: string
  reason: string
}

/** Why individual class picks are illegal, in pick order. Excess and shortage are counted separately. */
export function spellPickFlags(ctx: StepContext): PickFlag[] {
  const { rules, draft } = ctx
  const className = rules.classes.find((c) => c.slug === draft.class)?.name ?? 'chosen'
  const taken = takenElsewhere(ctx)
  const seen = new Set<string>()
  const flags: PickFlag[] = []
  for (const slug of draft.classSpells) {
    const spell = rules.spells.find((s) => s.slug === slug)
    const name = spell?.name ?? slug
    let reason: string | null = null
    if (!spell) reason = `${name} is no longer a known spell.`
    else if (spell.level > 1) reason = `${name} is above level 1.`
    else if (!draft.class || !spell.classes.includes(draft.class)) {
      reason = `${name} is not on the ${className} spell list.`
    } else if (seen.has(slug)) reason = `${name} is picked twice.`
    else if (taken.has(slug)) reason = `${name} is already granted or chosen elsewhere.`
    seen.add(slug)
    if (reason) flags.push({ slug, reason })
  }
  return flags
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export function validateSpells(ctx: StepContext): StepValidation {
  const { rules, draft } = ctx
  const allowance = spellAllowance(rules, draft.class)
  const issues: string[] = []
  let attention = false

  const flags = spellPickFlags(ctx)
  for (const f of flags) {
    attention = true
    issues.push(f.reason)
  }
  const flagged = new Set(flags.map((f) => f.slug))

  const count = (level: 0 | 1, max: number, label: string) => {
    const have = draft.classSpells.filter((slug) => {
      if (flagged.has(slug)) return false
      return rules.spells.find((s) => s.slug === slug)?.level === level
    }).length
    if (have === max) return
    // Too many is an error to fix; too few is just unfinished.
    if (have > max) attention = true
    issues.push(`Pick exactly ${label}, you have ${have}.`)
  }
  // A flagged pick of the right level is still a pick the player must resolve, so only legal picks
  // count towards the exact number; the flag above tells them what to remove.
  if (allowance.cantrips > 0 || draft.classSpells.length) {
    count(0, allowance.cantrips, plural(allowance.cantrips, 'cantrip', 'cantrips'))
  }
  if (allowance.spells > 0 || draft.classSpells.length) {
    count(1, allowance.spells, plural(allowance.spells, 'level 1 spell', 'level 1 spells'))
  }

  for (const g of spellGroups(ctx)) {
    if (g.status === 'attention') attention = true
    if (g.status !== 'valid') issues.push(...groupIssues(g))
  }
  return { state: attention ? 'attention' : issues.length ? 'incomplete' : 'valid', issues }
}

export interface SpellsView {
  cantrips: { max: number; picked: string[]; options: SpellOption[] }
  spells: { max: number; picked: string[]; options: SpellOption[] }
  /** Spells prepared each day (Cleric, Druid, Wizard); null for other classes or until abilities are set. */
  prepares: number | null
  /** The class prepares spells but the number waits on the casting ability score. */
  preparesPending: boolean
  /** Granted spells with display names, read-only. */
  granted: (GrantedSpell & { name: string })[]
  /** Racial spell choice groups (the High Elf cantrip). */
  groups: ResolvedGroup[]
}

/** Everything the Spells step renders, derived from the step context. */
export function spellsView(ctx: StepContext): SpellsView {
  const { rules, draft, stats, resolved } = ctx
  const allowance = spellAllowance(rules, draft.class)
  const levelOf = (slug: string) => rules.spells.find((s) => s.slug === slug)?.level
  const cs = stats.spellcasting
  const prepares = cs.status === 'ok' ? (cs.value?.preparedCount ?? null) : null
  const prepClass = ['cleric', 'druid', 'wizard'].includes(draft.class ?? '')
  return {
    cantrips: {
      max: allowance.cantrips,
      picked: draft.classSpells.filter((s) => levelOf(s) === 0),
      options: classSpellOptions(rules, draft.class, 0)
    },
    spells: {
      max: allowance.spells,
      picked: draft.classSpells.filter((s) => levelOf(s) === 1),
      options: classSpellOptions(rules, draft.class, 1)
    },
    prepares,
    preparesPending: prepClass && prepares === null,
    granted: resolved.grantedSpells.map((g) => ({
      ...g,
      name: rules.spells.find((s) => s.slug === g.spell)?.name ?? g.spell
    })),
    groups: spellGroups(ctx)
  }
}

/**
 * Change rule for class spells (#89, #97): picks stay across a class change and illegal ones are
 * flagged by `validateSpells`; only a class with no level 1 casting clears them, with a notice.
 */
export function reconcileSpells(
  rules: SpellRules,
  draft: Pick<CharacterDraft, 'class' | 'classSpells'>
): { classSpells: string[]; notices: string[] } {
  const { cantrips, spells } = spellAllowance(rules, draft.class)
  if (cantrips + spells > 0 || draft.classSpells.length === 0) {
    return { classSpells: draft.classSpells, notices: [] }
  }
  return {
    classSpells: [],
    notices: [
      draft.class
        ? 'Cleared your class spell picks: your class has no spells to pick at level 1.'
        : 'Cleared your class spell picks: they need a class.'
    ]
  }
}
