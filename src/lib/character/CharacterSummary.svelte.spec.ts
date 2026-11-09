import { page } from 'vitest/browser'
import { describe, it } from 'vitest'
import { expect } from 'vitest'
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
import CharacterSummary from './CharacterSummary.svelte'
import { buildSummary, type SummaryData } from './summary.ts'

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

const fighter: SummaryData = {
  name: 'Brannoch',
  alignment: 'lawful-good',
  race: 'human',
  subrace: null,
  class: 'fighter',
  subclass: null,
  background: 'acolyte',
  level: 1,
  appearance: '',
  personality: '',
  ideal: '',
  bond: '',
  flaw: '',
  backstory: 'Born under a bad sign',
  baseScores: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
  picks: {
    'class/fighter/proficiency-0': ['skill-athletics', 'skill-intimidation'],
    'class/fighter/fightingStyle-0': ['fighter-fighting-style-defense'],
    'race/human/language-0': ['dwarvish'],
    'background/acolyte/language-0': ['elvish', 'halfling']
  },
  equipment: [
    { item: 'chain-mail', quantity: 1 },
    { item: 'longsword', quantity: 1 }
  ]
}

describe('CharacterSummary', () => {
  it('shows every derived value, with AC labelled unarmored', async () => {
    render(CharacterSummary, { model: buildSummary(rules, fighter) })
    await expect.element(page.getByRole('heading', { name: 'Brannoch' })).toBeVisible()
    await expect.element(page.getByRole('group', { name: 'STR' })).toHaveTextContent('16')
    await expect.element(page.getByRole('group', { name: 'Hit points' })).toHaveTextContent('12')
    const ac = page.getByRole('group', { name: 'Armor class (unarmored)' })
    await expect.element(ac).toHaveTextContent('12')
    await expect.element(ac).toHaveTextContent('10 + DEX')
    await expect.element(page.getByText('Longsword: +5 to hit')).toBeVisible()
    await expect.element(page.getByText('Born under a bad sign')).toBeVisible()
  })

  it('expands a spell row to its details and collapses it again', async () => {
    render(CharacterSummary, {
      model: buildSummary(rules, { ...fighter, classSpells: ['fire-bolt'] })
    })
    const button = page.getByRole('button', { name: 'Details for Fire Bolt', exact: true })
    await expect.element(button).toHaveAttribute('aria-expanded', 'false')
    await button.click()
    await expect.element(button).toHaveAttribute('aria-expanded', 'true')
    const panelId = button.element().getAttribute('aria-controls')!
    const panel = page.elementLocator(document.getElementById(panelId)!)
    await expect.element(panel).toHaveTextContent(/Evocation/)
    await expect.element(panel).toHaveTextContent(/120 feet/)
    await button.click()
    await expect.element(button).toHaveAttribute('aria-expanded', 'false')
  })
})
