import { page } from 'vitest/browser'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import alignments from '#lib/rules/data/alignments.json'
import backgrounds from '#lib/rules/data/backgrounds.json'
import classLevels from '#lib/rules/data/classLevels.json'
import classes from '#lib/rules/data/classes.json'
import equipment from '#lib/rules/data/equipment.json'
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
import SkillsStep from './SkillsStep.svelte'
import { CharacterWizard } from './wizard.svelte.ts'

const rules = {
  alignments,
  backgrounds,
  classLevels,
  classes,
  equipment,
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

function setup(patch: Parameters<CharacterWizard['update']>[0]) {
  const wizard = new CharacterWizard(rules)
  wizard.update({
    name: 'Brenna',
    race: 'human',
    class: 'fighter',
    background: 'acolyte',
    ...patch
  })
  render(SkillsStep, { wizard })
  return wizard
}

const group = (name: RegExp) => page.getByRole('group', { name })

describe('SkillsStep', () => {
  it('groups choices by source and counts picks', async () => {
    setup({})

    await expect.element(page.getByRole('region', { name: /^Race: Human/ })).toBeVisible()
    await expect.element(page.getByRole('region', { name: /^Class: Fighter/ })).toBeVisible()
    await expect.element(page.getByRole('region', { name: /^Background: Acolyte/ })).toBeVisible()
    await expect.element(group(/Fighting Style/)).toHaveTextContent('0 of 1')
  })

  it('stops at the pick count by disabling the remaining options', async () => {
    const w = setup({})
    const skillsGroup = group(/Choose two skills/)

    await skillsGroup.getByRole('checkbox', { name: 'Athletics' }).click()
    await skillsGroup.getByRole('checkbox', { name: 'Acrobatics' }).click()

    expect(w.draft.picks['class/fighter/proficiency-0']).toHaveLength(2)
    await expect.element(skillsGroup.getByRole('checkbox', { name: 'History' })).toBeDisabled()
  })

  it('greys out an option already chosen in another group and says why', async () => {
    setup({ background: 'custom', picks: { 'class/fighter/proficiency-0': ['skill-athletics'] } })

    const custom = page.getByRole('group', { name: /Custom background: two skill/ })
    await expect.element(custom.getByRole('checkbox', { name: /Athletics/ })).toBeDisabled()
    await expect.element(custom).toHaveTextContent(/chosen elsewhere/)
  })

  it('swaps the pick in a one-pick group', async () => {
    const w = setup({})
    const style = group(/Fighting Style/)

    await style.getByRole('checkbox', { name: 'Archery' }).click()
    await style.getByRole('checkbox', { name: 'Defense' }).click()

    expect(w.draft.picks['class/fighter/fightingStyle-0']).toEqual([
      'fighter-fighting-style-defense'
    ])
  })

  it('flags a conflict created by an earlier change', async () => {
    setup({
      picks: { 'background/acolyte/language-0': ['common', 'elvish'] }
    })

    await expect.element(page.getByRole('alert')).toHaveTextContent(/Common is already granted/)
  })

  it('shows the custom background fields and writes them to the draft', async () => {
    const w = setup({ background: 'custom' })

    await page.getByRole('textbox', { name: 'Background name' }).fill('Wanderer')
    await page.getByRole('textbox', { name: 'Background feature' }).fill('You know the roads.')

    expect(w.draft.customBackgroundName).toBe('Wanderer')
    expect(w.draft.customBackgroundFeature).toBe('You know the roads.')
    await expect.element(page.getByText(/15 gp/)).toBeVisible()
  })

  it('offers the Acolyte personality tables but never requires them', async () => {
    const w = setup({})

    expect(w.step('skills')?.status).not.toBe('locked')
    await page
      .getByRole('combobox', { name: 'Bond table' })
      .selectOptions('Everything I do is for the common people.')
    expect(w.draft.bond).toBe('Everything I do is for the common people.')
    await page.getByRole('textbox', { name: 'Flaw' }).fill('My own flaw.')
    expect(w.draft.flaw).toBe('My own flaw.')
  })

  it('rolls a table entry into the free text', async () => {
    const w = setup({})

    await page.getByRole('button', { name: 'Roll Ideal' }).click()

    expect(w.draft.ideal).not.toBe('')
  })

  it('offers no tables for a custom background, free text only', async () => {
    setup({ background: 'custom' })

    await expect.element(page.getByRole('combobox', { name: 'Bond table' })).not.toBeInTheDocument()
  })
})
