import { deriveStats, type DerivedStats } from '#lib/rules/derive-stats.ts'
import { resolveFeatures, type ResolvedFeatures } from '#lib/rules/resolver.ts'
import {
  emptyDraft,
  reconcile,
  resolverDraft,
  type CharacterDraft,
  type WizardRules
} from './draft.ts'
import { ownedEquipment } from './equipment.ts'
import type { CharacterInput } from '#lib/server/character/service.ts'
import { tryDraftToCharacterInput } from './save.ts'
import { inertFieldAi } from '#lib/ai/field-ai.svelte.ts'
import type { CharacterAiField } from './ai-fields.ts'
import type { CharacterFieldAi } from './field-ai.svelte.ts'
import { computeSteps, STEPS, type StepDefinition, type StepId, type StepState } from './steps.ts'

/**
 * The wizard's reactive state: the browser-only Character draft, the derived resolved features and
 * stats, and the step rail. One instance per open wizard. Steps and the conversation panel read it
 * and call `update`; they never write `draft` directly, so change rules always run.
 */
export class CharacterWizard {
  readonly rules: WizardRules
  readonly #defs: readonly StepDefinition[]
  /** The saved Character being edited (review saves with PUT), or null for a new one. */
  readonly characterId: string | null

  draft = $state<CharacterDraft>(emptyDraft())
  /** Messages about choices cleared by the last changes; shown above the stats strip. */
  notices = $state<string[]>([])
  current = $state<StepId>('concept')
  /** Pending (un-accepted) AI suggestions per step, for the rail's dot (#116 maintains it). */
  suggestions = $state<Partial<Record<StepId, number>>>({})
  /** Bumped by every edit (and every AI write); a field's AI Undo expires when it changes. */
  revision = $state(0)
  /** The per-field AI controller; set by the shell during init. Without it the controls are inert. */
  ai: CharacterFieldAi | undefined
  /** True once the player has changed anything; guards leaving the page. */
  dirty = $state(false)
  /** True while the draft is being saved; the footer's Save button and Back are disabled. */
  saving = $state(false)
  /** Why the last save failed, shown on the Review step; null when none has failed. */
  saveError = $state<string | null>(null)

  /** Resolver output for the draft: choice groups, grants, structural issues. */
  resolved: ResolvedFeatures
  /** Every derived number (or `pending` with what is missing); feeds the stats strip. */
  stats: DerivedStats
  /** Rail state for each applicable step, in order. */
  steps: StepState[]
  /** The draft as the service's `CharacterInput`, or null while it cannot be saved. */
  characterInput: CharacterInput | null

  /**
   * @param initial a saved Character's draft (edit page): the wizard opens on it with nothing
   *   unsaved. Omit for a new Character.
   * @param characterId the id of the Character `initial` came from.
   */
  constructor(
    rules: WizardRules,
    defs: readonly StepDefinition[] = STEPS,
    initial?: CharacterDraft,
    characterId: string | null = null
  ) {
    this.rules = rules
    this.characterId = characterId
    if (initial) this.draft = initial
    this.#defs = defs
    this.resolved = $derived(resolveFeatures(rules, resolverDraft(this.draft)))
    this.stats = $derived(
      deriveStats(rules, this.resolved, {
        class: this.draft.class,
        level: this.draft.level,
        baseScores: this.draft.baseScores,
        equipment: ownedEquipment(rules, this.draft, this.resolved)
      })
    )
    this.characterInput = $derived(tryDraftToCharacterInput(rules, this.draft))
    this.steps = $derived(
      computeSteps(
        { rules, draft: this.draft, resolved: this.resolved, stats: this.stats },
        this.#defs
      )
    )
  }

  /** Applies a change to the draft, then the keep/clear rules; cleared choices become notices. */
  update(patch: Partial<CharacterDraft>) {
    const { draft, notices } = reconcile(this.rules, { ...this.draft, ...patch })
    this.draft = draft
    this.notices.push(...notices)
    this.dirty = true
    this.revision++
  }

  /** The props for one field's `FieldAi`; inert and disabled when no controller is attached. */
  aiField(field: CharacterAiField) {
    return this.ai?.field(field) ?? inertFieldAi('AI is not available here')
  }

  /** Everything an AI write may change (the draft and the notices it adds), for Field Undo. */
  snapshot() {
    return { draft: $state.snapshot(this.draft) as CharacterDraft, notices: [...this.notices] }
  }

  /** Puts a snapshot back as one edit: restores the field and everything cleared with it. */
  restore(snapshot: ReturnType<CharacterWizard['snapshot']>) {
    this.draft = snapshot.draft
    this.notices = [...snapshot.notices]
    this.revision++
  }

  dismissNotice(index: number) {
    this.notices.splice(index, 1)
  }

  step(id: StepId): StepState | undefined {
    return this.steps.find((s) => s.id === id)
  }

  /** Moves to a step unless it is locked, skipped, or a save is in flight. Returns whether it moved. */
  go(id: StepId): boolean {
    const target = this.step(id)
    if (!target || target.status === 'locked' || this.saving) return false
    this.current = id
    this.saveError = null
    return true
  }

  /** Neighbouring applicable steps in rail order (null at the ends). */
  get previous(): StepId | null {
    return this.#neighbour(-1)
  }
  get next(): StepId | null {
    return this.#neighbour(1)
  }
  #neighbour(offset: number): StepId | null {
    const i = this.steps.findIndex((s) => s.id === this.current)
    return this.steps[i + offset]?.id ?? null
  }
}
