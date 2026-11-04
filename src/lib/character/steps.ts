import type { DerivedStats } from '#lib/rules/derive-stats.ts'
import type { GroupKind, ResolvedFeatures, ResolvedGroup } from '#lib/rules/resolver.ts'
import { LIMITS, type CharacterDraft, type WizardRules } from './draft.ts'

/**
 * The wizard's step registry (#89, #109). Each step is a plain definition: an id, a label, whether
 * it applies to this draft, and a validity function. The shell derives rail statuses and gating
 * from the definitions alone, so a later ticket plugs a step in by replacing its entry in `STEPS`
 * (here) and its component in `step-views.ts`. Pure: no Svelte, no browser APIs.
 */
export type StepId = 'concept' | 'abilities' | 'skills' | 'equipment' | 'spells' | 'review'

/** locked: not open yet; incomplete: needs picks; attention: a pick is illegal; valid: done. */
export type StepStatus = 'locked' | 'incomplete' | 'attention' | 'valid'

/** Everything a step reads. All of it is derived from the draft, so steps stay pure. */
export interface StepContext {
  rules: WizardRules
  draft: CharacterDraft
  resolved: ResolvedFeatures
  stats: DerivedStats
}

export interface StepValidation {
  /** Never `locked`: locking is the shell's job. */
  state: 'incomplete' | 'attention' | 'valid'
  /** Plain-language reasons, shown on the step and as the rail's tooltip. */
  issues: string[]
}

export interface StepDefinition {
  id: StepId
  label: string
  /** False skips the step (not in the rail, not required for Review). Default: always applies. */
  applies?: (ctx: StepContext) => boolean
  validate: (ctx: StepContext) => StepValidation
  /**
   * What opens the step. `concept-valid` (default): Concept is valid. `all-valid`: every other
   * applicable step is valid (Review). `always`: Concept itself.
   */
  unlock?: 'always' | 'concept-valid' | 'all-valid'
}

export interface StepState {
  id: StepId
  label: string
  status: StepStatus
  issues: string[]
}

// --- Concept ------------------------------------------------------------------------------------

const LENGTH_FIELDS = [
  'name',
  'appearance',
  'personality',
  'ideal',
  'bond',
  'flaw',
  'backstory'
] as const

export function validateConcept({ draft, resolved }: StepContext): StepValidation {
  const issues: string[] = []
  let attention = false
  if (!draft.name.trim()) issues.push('Give your character a name.')
  const labels = {
    race: 'a race',
    subrace: 'a subrace',
    class: 'a class',
    subclass: 'a subclass',
    background: 'a background'
  }
  for (const s of resolved.structure) {
    if (s.type === 'missing') issues.push(`Choose ${labels[s.field]}.`)
    else {
      attention = true
      issues.push(`The ${s.field} choice no longer fits; choose another.`)
    }
  }
  for (const field of LENGTH_FIELDS) {
    if (draft[field].length > LIMITS[field]) {
      attention = true
      issues.push(`${field[0].toUpperCase()}${field.slice(1)} is over ${LIMITS[field]} characters.`)
    }
  }
  return { state: attention ? 'attention' : issues.length ? 'incomplete' : 'valid', issues }
}

// --- Skills & features (#112) -------------------------------------------------------------------

/**
 * The choice-group kinds step 3 owns. The rest belong elsewhere: the subclass chooser to Concept,
 * Half-Elf ability bonuses to Ability scores (#110), the High Elf cantrip to Spells (#114).
 */
export const SKILLS_STEP_KINDS: readonly GroupKind[] = [
  'skill',
  'tool',
  'toolOrLanguage',
  'language',
  'expertise',
  'feature',
  'creatureType',
  'terrain',
  'dragonType',
  'race'
]

export const skillsStepGroups = (resolved: ResolvedFeatures): ResolvedGroup[] =>
  resolved.groups.filter((g) => SKILLS_STEP_KINDS.includes(g.kind))

const KIND_LABELS: Partial<Record<GroupKind, string>> = {
  skill: 'Skills',
  tool: 'Tools',
  toolOrLanguage: 'Tools or languages',
  language: 'Languages',
  expertise: 'Expertise',
  feature: 'Fighting Style',
  creatureType: 'Favored enemy',
  terrain: 'Favored terrain',
  dragonType: 'Draconic ancestry',
  race: 'Favored enemy races'
}

/** A plain-language name for a choice group. */
export const groupLabel = (g: ResolvedGroup): string =>
  g.description ?? KIND_LABELS[g.kind] ?? g.groupKey

/** Plain-language reasons a choice group is not valid yet. */
export function groupIssues(g: ResolvedGroup): string[] {
  const name = (slug: string) => g.options.find((o) => o.slug === slug)?.name ?? slug
  const out: string[] = []
  for (const i of g.issues) {
    if (i.type === 'conflict') {
      out.push(
        `${groupLabel(g)}: ${name(i.slug)} is already ${i.with === 'granted' ? 'granted to you' : 'chosen elsewhere'}. Pick another.`
      )
    } else if (i.type === 'unknown-option') {
      out.push(`${groupLabel(g)}: ${i.slug} is no longer an option. Pick another.`)
    } else if (i.type === 'duplicate') {
      out.push(`${groupLabel(g)}: ${name(i.slug)} is picked twice.`)
    } else if (i.type === 'excess') {
      out.push(`${groupLabel(g)}: too many picks; choose ${g.choose}.`)
    } else {
      out.push(`${groupLabel(g)}: choose at most one tool.`)
    }
  }
  if (g.status === 'incomplete') {
    const left = g.choose - new Set(g.picks).size
    out.push(`${groupLabel(g)}: choose ${left} more.`)
  }
  return out
}

export function validateSkills({ draft, resolved }: StepContext): StepValidation {
  const issues: string[] = []
  let attention = false
  if (draft.background === 'custom') {
    if (!draft.customBackgroundName.trim()) issues.push('Name your custom background.')
    if (!draft.customBackgroundFeature.trim()) {
      issues.push('Describe your custom background feature.')
    }
    for (const f of ['customBackgroundName', 'customBackgroundFeature'] as const) {
      if (draft[f].length > LIMITS[f]) {
        attention = true
        issues.push(
          `The custom background ${f === 'customBackgroundName' ? 'name' : 'feature'} is over ${LIMITS[f]} characters.`
        )
      }
    }
  }
  for (const g of skillsStepGroups(resolved)) {
    if (g.status === 'attention') attention = true
    if (g.status !== 'valid') issues.push(...groupIssues(g))
  }
  return { state: attention ? 'attention' : issues.length ? 'incomplete' : 'valid', issues }
}

// --- Spells applicability -----------------------------------------------------------------------

/** A class that casts at level 1, or any draft with a spell pick (High Elf cantrip). */
export function castsAtLevel1({ rules, draft, resolved }: StepContext): boolean {
  const row = rules.classLevels.find((l) => l.class === draft.class && l.level === 1)
  const sc = row?.spellcasting
  const classCasts =
    !!sc &&
    ((sc.cantripsKnown ?? 0) > 0 || (sc.spellsKnown ?? 0) > 0 || sc.slots.some((n) => n > 0))
  return classCasts || resolved.groups.some((g) => g.kind === 'spell')
}

// --- Registry -----------------------------------------------------------------------------------

/** Placeholder for a step a later ticket builds: never valid, so Review stays locked. */
const comingSoon = (
  id: StepId,
  label: string,
  extra: Partial<StepDefinition> = {}
): StepDefinition => ({
  id,
  label,
  validate: () => ({ state: 'incomplete', issues: ['This step is not available yet.'] }),
  ...extra
})

/**
 * The steps in rail order. Replace a `comingSoon` entry to build its step (#110 abilities,
 * #112 skills, #113 equipment, #114 spells, #111 review).
 */
export const STEPS: readonly StepDefinition[] = [
  { id: 'concept', label: 'Concept', unlock: 'always', validate: validateConcept },
  comingSoon('abilities', 'Ability scores'),
  { id: 'skills', label: 'Skills & features', validate: validateSkills },
  comingSoon('equipment', 'Equipment'),
  comingSoon('spells', 'Spells', { applies: castsAtLevel1 }),
  comingSoon('review', 'Review', { unlock: 'all-valid' })
]

/**
 * Rail state for every applicable step, in order. Locked steps still report their issues so the
 * rail can explain itself, but a locked step never counts as valid.
 */
export function computeSteps(
  ctx: StepContext,
  defs: readonly StepDefinition[] = STEPS
): StepState[] {
  const applicable = defs.filter((d) => d.applies?.(ctx) ?? true)
  const results = applicable.map((d) => ({ def: d, v: d.validate(ctx) }))
  const conceptValid = results.find((r) => r.def.id === 'concept')?.v.state === 'valid'
  return results.map(({ def, v }) => {
    const unlock = def.unlock ?? 'concept-valid'
    const open =
      unlock === 'always' ||
      (unlock === 'concept-valid' && conceptValid) ||
      (unlock === 'all-valid' && results.every((r) => r.def.id === def.id || r.v.state === 'valid'))
    return { id: def.id, label: def.label, status: open ? v.state : 'locked', issues: v.issues }
  })
}
