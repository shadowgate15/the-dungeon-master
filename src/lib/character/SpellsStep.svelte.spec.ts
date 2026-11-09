import { page, userEvent } from 'vitest/browser'
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
  describe('spell details', () => {
    const detailsOf = (scope: ReturnType<typeof page.getByTestId>, name: string) =>
      scope.getByRole('button', { name: `Details for ${name}`, exact: true })

    it('expands a cantrip inline with its fields and collapses it again', async () => {
      setup()
      const group = page.getByTestId('spell-picks-cantrips')
      const button = detailsOf(group, 'Fire Bolt')
      await expect.element(button).toHaveAttribute('aria-expanded', 'false')

      await button.click()
      await expect.element(button).toHaveAttribute('aria-expanded', 'true')
      const panelId = button.element().getAttribute('aria-controls')!
      const panel = page.elementLocator(document.getElementById(panelId)!)
      await expect.element(panel).toHaveTextContent(/Evocation/)
      await expect.element(panel).toHaveTextContent(/Cantrip/)
      await expect.element(panel).toHaveTextContent(/Casting time/)
      await expect.element(panel).toHaveTextContent(/1 action/)
      await expect.element(panel).toHaveTextContent(/120 feet/)
      await expect.element(panel).toHaveTextContent(/V, S/)
      await expect.element(panel).toHaveTextContent(/Instantaneous/)
      await expect.element(panel).toHaveTextContent(/ranged spell attack/)

      await button.click()
      await expect.element(button).toHaveAttribute('aria-expanded', 'false')
      expect(document.getElementById(panelId)).toBeNull()
    })

    it('shows level, material text, concentration, ritual and higher levels for a level 1 spell', async () => {
      setup()
      const group = page.getByTestId('spell-picks-spells')
      await detailsOf(group, 'Sleep').click()
      const sleep = page.elementLocator(
        document.getElementById(detailsOf(group, 'Sleep').element().getAttribute('aria-controls')!)!
      )
      await expect.element(sleep).toHaveTextContent(/Level 1/)
      await expect.element(sleep).toHaveTextContent(/V, S, M \(A pinch of fine sand/)
      await expect.element(sleep).toHaveTextContent(/At higher levels/)
      await expect.element(sleep).not.toHaveTextContent(/Ritual/)

      await detailsOf(group, 'Detect Magic').click()
      const detect = page.elementLocator(
        document.getElementById(
          detailsOf(group, 'Detect Magic').element().getAttribute('aria-controls')!
        )!
      )
      await expect.element(detect).toHaveTextContent(/Up to 10 minutes \(concentration\)/)
      await expect.element(detect).toHaveTextContent(/Ritual/)
      await expect.element(detect).not.toHaveTextContent(/At higher levels/)
    })

    it('opens several at once', async () => {
      setup()
      const group = page.getByTestId('spell-picks-cantrips')
      await detailsOf(group, 'Fire Bolt').click()
      await detailsOf(group, 'Mage Hand').click()
      await expect.element(detailsOf(group, 'Fire Bolt')).toHaveAttribute('aria-expanded', 'true')
      await expect.element(detailsOf(group, 'Mage Hand')).toHaveAttribute('aria-expanded', 'true')
    })

    it('works from the keyboard with Tab, Enter and Space', async () => {
      setup()
      const group = page.getByTestId('spell-picks-cantrips')
      const button = detailsOf(group, 'Acid Splash')
      const box = group.getByRole('checkbox', { name: 'Acid Splash' })
      box.element().focus()
      await userEvent.tab()
      expect(document.activeElement).toBe(button.element())
      await userEvent.keyboard('{Enter}')
      await expect.element(button).toHaveAttribute('aria-expanded', 'true')
      await userEvent.keyboard(' ')
      await expect.element(button).toHaveAttribute('aria-expanded', 'false')
    })

    it('never changes picks, disabled reasons or the count when toggled', async () => {
      const wizard = setup({ classSpells: ['acid-splash', 'fire-bolt', 'light'] })
      const group = page.getByTestId('spell-picks-cantrips')
      await detailsOf(group, 'Acid Splash').click()
      await detailsOf(group, 'Mage Hand').click()
      await detailsOf(group, 'Mage Hand').click()
      expect(wizard.draft.classSpells).toEqual(['acid-splash', 'fire-bolt', 'light'])
      await expect.element(group).toHaveTextContent(/3 of 3/)
      await expect.element(group.getByRole('checkbox', { name: 'Acid Splash' })).toBeChecked()
      await expect
        .element(group.getByRole('checkbox', { name: /Mage Hand \(limit reached\)/ }))
        .toBeDisabled()
    })

    it('is available on the Wizard spellbook list', async () => {
      const wizard = setup()
      const group = page.getByTestId('spell-picks-spells')
      await detailsOf(group, 'Burning Hands').click()
      await expect
        .element(detailsOf(group, 'Burning Hands'))
        .toHaveAttribute('aria-expanded', 'true')
      expect(wizard.draft.classSpells).toEqual([])
    })

    it('is available on granted spells and the High Elf cantrip group', async () => {
      setup({ class: 'cleric' })
      await detailsOf(page.getByTestId('granted-spells'), 'Bless').click()
      await expect.element(page.getByTestId('granted-spells')).toHaveTextContent(/At higher levels/)
    })

    it('is available on racial group options', async () => {
      const wizard = setup({ race: 'elf', subrace: 'high-elf' })
      const fieldset = page.elementLocator(
        document.querySelector('[data-choice-key="trait/high-elf-cantrip/cantrip-0"]')!
      )
      await detailsOf(fieldset, 'Prestidigitation').click()
      await expect
        .element(detailsOf(fieldset, 'Prestidigitation'))
        .toHaveAttribute('aria-expanded', 'true')
      expect(wizard.draft.picks['trait/high-elf-cantrip/cantrip-0']).toBeUndefined()
    })

    it('shows a Tiefling thaumaturgy as a granted spell with details', async () => {
      const wizard = setup({ race: 'tiefling' })
      const granted = page.getByTestId('granted-spells')
      await expect.element(granted).toHaveTextContent(/Thaumaturgy/)
      const button = detailsOf(granted, 'Thaumaturgy')
      await button.click()
      await expect.element(button).toHaveAttribute('aria-expanded', 'true')
      const panelId = button.element().getAttribute('aria-controls')!
      const panel = page.elementLocator(document.getElementById(panelId)!)
      await expect.element(panel).toHaveTextContent(/Transmutation/)
      await expect.element(panel).toHaveTextContent(/Cantrip/)
      expect(wizard.draft.classSpells).toEqual([])
    })

    it('never toggles a racial pick when its details are opened, from the keyboard too', async () => {
      const wizard = setup({ race: 'elf', subrace: 'high-elf' })
      const key = 'trait/high-elf-cantrip/cantrip-0'
      const fieldset = page.getByRole('group', { name: /One wizard cantrip/ })
      const box = fieldset.getByRole('checkbox', { name: 'Prestidigitation' })
      await box.click()
      expect(wizard.draft.picks[key]).toEqual(['prestidigitation'])

      const button = detailsOf(fieldset, 'Prestidigitation')
      await button.click()
      await button.click()
      expect(wizard.draft.picks[key]).toEqual(['prestidigitation'])
      await expect.element(box).toBeChecked()

      box.element().focus()
      await userEvent.tab()
      expect(document.activeElement).toBe(button.element())
      await userEvent.keyboard('{Enter}')
      await expect.element(button).toHaveAttribute('aria-expanded', 'true')
      expect(wizard.draft.picks[key]).toEqual(['prestidigitation'])
    })
  })
})
