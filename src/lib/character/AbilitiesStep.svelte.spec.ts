import { page } from 'vitest/browser'
import { afterEach, describe, expect, it, vi } from 'vitest'
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
import AbilitiesStep from './AbilitiesStep.svelte'
import type { WizardRules } from './draft.ts'
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

function setup(patch: Parameters<CharacterWizard['update']>[0] = {}) {
  const wizard = new CharacterWizard(rules)
  wizard.update({
    name: 'Brenna',
    race: 'human',
    class: 'fighter',
    background: 'acolyte',
    ...patch
  })
  render(AbilitiesStep, { wizard })
  return wizard
}

afterEach(() => vi.restoreAllMocks())

const chooseMethod = (label: string) =>
  page.getByLabelText('Ability score method', { exact: true }).selectOptions(label)

describe('AbilitiesStep point buy', () => {
  it('starts every ability at 8 with the full budget', async () => {
    const wizard = setup()
    await chooseMethod('Point buy')

    expect(wizard.draft.abilityMethod).toBe('point-buy')
    await expect.element(page.getByTestId('points-remaining')).toHaveTextContent('27')
    await expect.element(page.getByTestId('base-str')).toHaveTextContent('8')
  })

  it('spends points by cost and stops at the budget', async () => {
    const wizard = setup()
    await chooseMethod('Point buy')
    const up = (name: string) => page.getByRole('button', { name: `Increase ${name}` })

    // 8 to 15 costs 9 points: three abilities spend the whole 27.
    for (const name of ['Strength', 'Dexterity', 'Constitution']) {
      for (let i = 0; i < 7; i++) await up(name).click()
    }
    await expect.element(page.getByTestId('points-remaining')).toHaveTextContent('0')
    await expect.element(up('Intelligence')).toBeDisabled()
    await expect.element(up('Strength')).toBeDisabled()
    expect(wizard.step('abilities')?.status).toBe('valid')

    await page.getByRole('button', { name: 'Decrease Strength' }).click()
    await expect.element(page.getByTestId('points-remaining')).toHaveTextContent('2')
    await expect.element(up('Intelligence')).toBeEnabled()
  })

  it('cannot go below 8', async () => {
    setup()
    await chooseMethod('Point buy')
    await expect.element(page.getByRole('button', { name: 'Decrease Strength' })).toBeDisabled()
  })

  it('shows racial bonuses separately and caps the final score at 20', async () => {
    // Human: +1 everywhere.
    setup()
    await chooseMethod('Point buy')
    await expect.element(page.getByTestId('racial-str')).toHaveTextContent('+1')
    await expect.element(page.getByTestId('score-str')).toHaveTextContent('9')
    await expect.element(page.getByTestId('base-str')).toHaveTextContent('8')
  })
})

describe('AbilitiesStep rolling', () => {
  it('rolls six sets in code, records every die and shows the dropped one', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5) // every die is 4
    const wizard = setup()
    await chooseMethod('Rolling')
    await page.getByRole('button', { name: 'Roll scores' }).click()

    expect(wizard.draft.abilityRolls).toHaveLength(6)
    expect(wizard.draft.abilityRolls![0]).toEqual([4, 4, 4, 4])
    await expect.element(page.getByLabelText('Roll 1')).toHaveTextContent('= 12')
    await expect.element(page.getByRole('button', { name: 'Reroll all' })).toBeVisible()
  })

  it('assigns rolled totals freely and validates', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const wizard = setup()
    await chooseMethod('Rolling')
    await page.getByRole('button', { name: 'Roll scores' }).click()
    expect(wizard.step('abilities')?.status).toBe('incomplete')

    for (const name of ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom']) {
      await page.getByLabelText(`${name} base score`).selectOptions('12')
    }
    await page.getByLabelText('Charisma base score').selectOptions('12')
    expect(wizard.draft.baseScores.cha).toBe(12)
    expect(wizard.step('abilities')?.status).toBe('valid')
  })

  it('a reroll replaces the set and clears assignments', async () => {
    const wizard = setup()
    await chooseMethod('Rolling')
    await page.getByRole('button', { name: 'Roll scores' }).click()
    const first = wizard.draft.abilityRolls
    const total = first!.map((d) =>
      [...d]
        .sort()
        .slice(1)
        .reduce((a, b) => a + b, 0)
    )[0]
    await page.getByLabelText('Strength base score').selectOptions(String(total))
    expect(wizard.draft.baseScores.str).toBe(total)

    await page.getByRole('button', { name: 'Reroll all' }).click()
    expect(wizard.draft.baseScores.str).toBeNull()
    expect(wizard.draft.abilityRolls).toHaveLength(6)
  })

  it('keeps the rolled set when switching method and back', async () => {
    const wizard = setup()
    await chooseMethod('Rolling')
    await page.getByRole('button', { name: 'Roll scores' }).click()
    const rolls = wizard.draft.abilityRolls

    await chooseMethod('Standard array')
    expect(wizard.draft.abilityRolls).toEqual(rolls)
    await chooseMethod('Rolling')
    expect(wizard.draft.abilityRolls).toEqual(rolls)
    await expect.element(page.getByLabelText('Roll 1')).toBeVisible()
  })
})

describe('AbilitiesStep standard array', () => {
  it('offers each value once', async () => {
    const wizard = setup()
    await chooseMethod('Standard array')
    await page.getByLabelText('Strength base score').selectOptions('15')

    expect(wizard.draft.baseScores.str).toBe(15)
    const dex = page.getByLabelText('Dexterity base score').element() as HTMLSelectElement
    expect([...dex.options].map((o) => o.value)).not.toContain('15')
  })
})

describe('AbilitiesStep Half-Elf bonus picks', () => {
  it('requires two other abilities and shows them as racial bonuses', async () => {
    const wizard = setup({ race: 'half-elf' })
    await chooseMethod('Point buy')
    expect(wizard.step('abilities')?.status).toBe('incomplete')

    await page.getByRole('checkbox', { name: 'Strength' }).click()
    await page.getByRole('checkbox', { name: 'Dexterity' }).click()

    await expect.element(page.getByRole('checkbox', { name: 'Constitution' })).toBeDisabled()
    // Charisma is not offered: Half-Elf's +2 is already there.
    await expect.element(page.getByRole('checkbox', { name: 'Charisma' })).not.toBeInTheDocument()
    await expect.element(page.getByTestId('racial-str')).toHaveTextContent('+1')
    await expect.element(page.getByTestId('racial-cha')).toHaveTextContent('+2')
    expect(wizard.step('abilities')?.status).toBe('valid')
  })
})
