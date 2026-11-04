import type { DerivedStats } from '#lib/rules/derive-stats.ts'
import type { ResolvedFeatures } from '#lib/rules/resolver.ts'
import { validateEquipment } from './equipment.ts'
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
  comingSoon('skills', 'Skills & features'),
  { id: 'equipment', label: 'Equipment', validate: validateEquipment },
  comingSoon('spells', 'Spells', { applies: castsAtLevel1 }),
  {
    id: 'review',
    label: 'Review',
    unlock: 'all-valid',
    validate: () => ({ state: 'valid', issues: [] })
  }
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
