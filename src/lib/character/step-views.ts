import type { Component } from 'svelte'
import AbilitiesStep from './AbilitiesStep.svelte'
import ComingSoonStep from './ComingSoonStep.svelte'
import ConceptStep from './ConceptStep.svelte'
import type { StepId } from './steps.ts'
import type { CharacterWizard } from './wizard.svelte.ts'

/**
 * The component rendered in the centre column for each step. A later ticket swaps its
 * `ComingSoonStep` for the real step component here, next to replacing its `STEPS` entry in
 * `steps.ts`. A step component takes one prop, the shared `wizard`, and reads and writes the
 * draft through `wizard.update`.
 */
export const STEP_VIEWS: Record<StepId, Component<{ wizard: CharacterWizard }>> = {
  concept: ConceptStep,
  abilities: AbilitiesStep,
  skills: ComingSoonStep,
  equipment: ComingSoonStep,
  spells: ComingSoonStep,
  review: ComingSoonStep
}
