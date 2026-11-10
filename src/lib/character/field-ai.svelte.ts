import { createFieldAi, type FieldAi } from '#lib/ai/field-ai.svelte.ts'
import type { AiStatusStore } from '#lib/ai/ai-status.svelte.ts'
import {
  CHARACTER_AI_FIELDS,
  CHARACTER_SLUG_FIELDS,
  type CharacterAiField,
  type CharacterAiValues
} from './ai-fields.ts'
import {
  applyGroupValue,
  groupBlockedReason,
  groupDefinition,
  isGroupField,
  type GroupValue
} from './ai-groups.ts'
import { ABILITY_KEYS, methodPatch, rollTotals, type DraftAbilityMethod } from './ability-scores.ts'
import type { CharacterWizard } from './wizard.svelte.ts'

/**
 * Per-field AI for the Character wizard (create and edit). Call once during component init (the
 * shell does). AI writes go through `wizard.update`, so they follow exactly the reconcile-and-flag
 * rules of a manual edit, with no cascade and no confirmation. Undo restores the field and
 * everything the write cleared (a whole-draft snapshot) and expires on the next edit.
 *
 * To add a field (#148, #149): add it to `CHARACTER_AI_FIELDS` and the server registry, then
 * render `<FieldAi {...wizard.aiField('x')} ... />` for it; groups that are not a plain string
 * value extend `values`/`set` here.
 */
export type CharacterFieldAi = FieldAi<string, string | GroupValue>

const isSlug = (field: CharacterAiField) =>
  (CHARACTER_SLUG_FIELDS as readonly string[]).includes(field)

type CharacterDraftScores = CharacterWizard['draft']['baseScores']

/** A field's form value as a string; ability scores travel as JSON in ability order. */
function readValue(wizard: CharacterWizard, field: CharacterAiField): string {
  if (field === 'abilityScores') {
    const scores = wizard.draft.baseScores
    if (ABILITY_KEYS.some((k) => scores[k] === null)) return ''
    return JSON.stringify(Object.fromEntries(ABILITY_KEYS.map((k) => [k, scores[k]])))
  }
  return (wizard.draft[field] as string | null) ?? ''
}

export function createCharacterFieldAi(wizard: CharacterWizard, ai: AiStatusStore) {
  return createFieldAi<string, string | GroupValue>({
    flow: 'character',
    ai,
    values: () =>
      Object.fromEntries(
        CHARACTER_AI_FIELDS.map((f) => [f, readValue(wizard, f)])
      ) as CharacterAiValues,
    // Pick groups: the request carries the draft's groups so the server can build legal options.
    current: (field) => (isGroupField(field) ? wizard.groupText(field) : wizard.fieldText(field)),
    extra: () => {
      const rolls = wizard.draft.abilityRolls
      return {
        choices: {
          picks: $state.snapshot(wizard.draft.picks),
          equipment: $state.snapshot(wizard.draft.equipment),
          classSpells: $state.snapshot(wizard.draft.classSpells)
        },
        ...(rolls?.length ? { rolledTotals: rollTotals(rolls) } : {})
      }
    },
    // The arrangement button rolls first when the method is rolling and no set exists. The
    // snapshot is taken before the roll so Undo takes the roll back too.
    prepare: (field) => {
      if (
        field === 'abilityScores' &&
        wizard.draft.abilityMethod === 'rolling' &&
        !wizard.draft.abilityRolls?.length
      ) {
        const snapshot = wizard.snapshot()
        wizard.rollAbilities()
        return { snapshot }
      }
    },
    set: (field, value) => {
      if (isGroupField(field)) {
        wizard.update(applyGroupValue(wizard.rules, wizard.draft, field, value as GroupValue))
        return
      }
      const text = value as string
      if (field === 'abilityMethod') wizard.update(methodPatch(text as DraftAbilityMethod))
      else if (field === 'abilityScores') {
        wizard.update({ baseScores: JSON.parse(text) as CharacterDraftScores })
      } else {
        wizard.update({ [field]: isSlug(field as CharacterAiField) ? text || null : text } as never)
      }
    },
    snapshot: () => wizard.snapshot(),
    restore: (snapshot) => wizard.restore(snapshot as ReturnType<CharacterWizard['snapshot']>),
    version: () => wizard.revision,
    blockedReason: (field) => {
      if (isGroupField(field)) {
        return groupBlockedReason(groupDefinition(wizard.rules, wizard.draft, field), wizard.draft)
      }
      if (field === 'subclass') {
        if (!wizard.draft.class) return 'Choose a class first'
        const group = wizard.resolved.groups.find((g) => g.kind === 'subclass')
        if (!group) return 'This class has no subclass to choose'
        if (group.options.length < 2) return 'The SRD offers only one, so it is selected for you'
      }
      if (field === 'abilityScores' && !wizard.draft.abilityMethod) {
        return 'Choose an ability score method first'
      }
      if (field === 'subrace') {
        if (!wizard.draft.race) return 'Choose a race first'
        if (!wizard.rules.subraces.some((s) => s.race === wizard.draft.race)) {
          return 'This race has no subraces'
        }
      }
      return undefined
    }
  })
}
