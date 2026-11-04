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
import SpellsStep from './SpellsStep.svelte'
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
    name: 'Ila',
    race: 'human',
    class: 'wizard',
    background: 'acolyte',
    baseScores: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 },
    ...patch
  })
  render(SpellsStep, { wizard })
  return wizard
}

describe('SpellsStep', () => {
  it('picks cantrips up to the limit, then disables the rest', async () => {
    const wizard = setup()
    const group = page.getByTestId('spell-picks-cantrips')

    await group.getByRole('checkbox', { name: 'Acid Splash' }).click()
    await group.getByRole('checkbox', { name: 'Fire Bolt' }).click()
    await group.getByRole('checkbox', { name: 'Light', exact: true }).click()

    expect(wizard.draft.classSpells).toEqual(['acid-splash', 'fire-bolt', 'light'])
    await expect.element(group.getByRole('checkbox', { name: /Mage Hand/ })).toBeDisabled()
  })

  it('shows the prepares hint for a wizard', async () => {
    setup()
    await expect.element(page.getByTestId('prepares-hint')).toHaveTextContent(/prepare 4 spells/)
  })

  it('offers no level 1 picks to a cleric', async () => {
    setup({ class: 'cleric' })
    await expect.element(page.getByTestId('spell-picks-cantrips')).toBeVisible()
    expect(page.getByTestId('spell-picks-spells').elements()).toHaveLength(0)
  })

  it('shows granted spells read-only and the High Elf cantrip choice', async () => {
    const wizard = setup({ race: 'elf', subrace: 'high-elf' })
    await page.getByRole('checkbox', { name: 'Prestidigitation' }).first().click()
    expect(wizard.draft.picks['trait/high-elf-cantrip/cantrip-0']).toEqual(['prestidigitation'])
    await expect
      .element(
        page.getByTestId('spell-picks-cantrips').getByRole('checkbox', { name: /Prestidigitation/ })
      )
      .toBeDisabled()
  })

  it('lists granted spells for a Life cleric', async () => {
    setup({ class: 'cleric' })
    await expect.element(page.getByTestId('granted-spells')).toHaveTextContent(/Bless/)
  })

  it('flags a pick the class cannot take and lets the player remove it', async () => {
    const wizard = setup({ class: 'cleric', classSpells: ['fire-bolt'] })
    await expect.element(page.getByTestId('spell-flags')).toHaveTextContent(/not on the Cleric/)
    await page.getByRole('button', { name: /Remove Fire Bolt/ }).click()
    expect(wizard.draft.classSpells).toEqual([])
  })
})
