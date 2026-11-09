import { page } from 'vitest/browser'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import alignments from '#lib/rules/data/alignments.json'
import backgrounds from '#lib/rules/data/backgrounds.json'
import classLevels from '#lib/rules/data/classLevels.json'
import classes from '#lib/rules/data/classes.json'
import equipment from '#lib/rules/data/equipment.json'
import equipmentCategories from '#lib/rules/data/equipmentCategories.json'
import features from '#lib/rules/data/features.json'
import languages from '#lib/rules/data/languages.json'
import proficiencies from '#lib/rules/data/proficiencies.json'
import races from '#lib/rules/data/races.json'
import skills from '#lib/rules/data/skills.json'
import spells from '#lib/rules/data/spells.json'
import subclassLevels from '#lib/rules/data/subclassLevels.json'
import subclasses from '#lib/rules/data/subclasses.json'
import subraces from '#lib/rules/data/subraces.json'
import traits from '#lib/rules/data/traits.json'
import type { WizardRules } from './draft.ts'
import ReviewStep from './ReviewStep.svelte'
import { CharacterWizard } from './wizard.svelte.ts'

const rules = {
  alignments,
  backgrounds,
  classLevels,
  classes,
  equipment,
  equipmentCategories,
  features,
  languages,
  proficiencies,
  races,
  skills,
  spells,
  subclassLevels,
  subclasses,
  subraces,
  traits
} as unknown as WizardRules

function readyWizard() {
  const wizard = new CharacterWizard(rules)
  wizard.update({
    name: 'Brannoch',
    race: 'human',
    class: 'fighter',
    background: 'acolyte',
    abilityMethod: 'standard-array',
    baseScores: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 }
  })
  wizard.dirty = true
  return wizard
}

describe('ReviewStep spell details', () => {
  it('expands a spell row in the summary to its details', async () => {
    const wizard = readyWizard()
    wizard.update({ class: 'wizard', classSpells: ['fire-bolt'] })
    render(ReviewStep, { wizard })
    const button = page.getByRole('button', { name: 'Details for Fire Bolt', exact: true })
    await expect.element(button).toHaveAttribute('aria-expanded', 'false')
    await button.click()
    await expect.element(button).toHaveAttribute('aria-expanded', 'true')
    const panelId = button.element().getAttribute('aria-controls')!
    const panel = page.elementLocator(document.getElementById(panelId)!)
    await expect.element(panel).toHaveTextContent(/Evocation/)
  })
})
