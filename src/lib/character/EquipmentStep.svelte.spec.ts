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
import type { CharacterDraft, WizardRules } from './draft.ts'
import EquipmentStep from './EquipmentStep.svelte'
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

function setup(patch: Partial<CharacterDraft> = {}) {
  const wizard = new CharacterWizard(rules)
  wizard.update({
    name: 'Brenna',
    race: 'human',
    class: 'fighter',
    background: 'acolyte',
    ...patch
  })
  render(EquipmentStep, { wizard })
  return wizard
}

describe('EquipmentStep', () => {
  it('shows fixed class items and the background package read-only', async () => {
    setup({ class: 'rogue' })

    await expect
      .element(page.getByTestId('equipment-fixed-class'))
      .toHaveTextContent(/Thieves' Tools/i)
    await expect.element(page.getByTestId('equipment-fixed-background')).toHaveTextContent(/Pouch/)
  })

  it('asks for a specific item once a wildcard option is chosen', async () => {
    const wizard = setup()

    await page.getByRole('radio', { name: /Any of Martial Weapons, Shield/ }).click()
    await page.getByRole('combobox', { name: 'Martial Weapons item 1' }).selectOptions('longsword')

    expect(wizard.draft.equipment['class/fighter/equipment-1']).toEqual({
      option: 0,
      wild: ['longsword']
    })
  })

  it('disables a proficiency-conditional option and says why', async () => {
    setup({ class: 'cleric' })

    await expect.element(page.getByRole('radio', { name: /Warhammer/ })).toBeDisabled()
    await expect.element(page.getByText(/Requires proficiency with Warhammers/)).toBeVisible()
  })

  it('preselects the always-picked focus group and asks for the variant', async () => {
    setup({ class: 'paladin' })

    await expect
      .element(page.getByRole('combobox', { name: 'Holy Symbols item 1' }).first())
      .toBeVisible()
  })
})
