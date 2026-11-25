import { expect, type Locator, type Page } from '@playwright/test'

/** Shared Character wizard steps for e2e tests. */

/** Starts a new Character draft and waits for the wizard to hydrate. */
export async function newCharacter(page: Page) {
  await page.getByRole('button', { name: 'New Character' }).click()
  await expect(page).toHaveURL(/\/party\?draft=/)
  await page.waitForLoadState('networkidle')
}

export const draftSaved = (page: Page) => expect(page.getByText('Draft saved')).toBeVisible()
export const step = (page: Page, name: RegExp) =>
  page.getByRole('navigation', { name: 'Steps' }).getByRole('button', { name })

export async function fillConcept(page: Page) {
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Brannoch')
  await page.getByRole('combobox', { name: 'Race', exact: true }).selectOption('human')
  await page.getByRole('combobox', { name: 'Class', exact: true }).selectOption('fighter')
  await page.getByRole('combobox', { name: 'Background', exact: true }).selectOption('acolyte')
}

/** Ticks the first allowed options of each choice group until none asks for more. */
export async function pickEveryGroup(groups: Locator) {
  for (const group of await groups.all()) {
    const boxes = group.getByRole('checkbox')
    for (let i = 0; i < (await boxes.count()); i++) {
      if (!(await group.getByTestId('group-incomplete').isVisible())) break
      const box = boxes.nth(i)
      if ((await box.isEnabled()) && !(await box.isChecked())) await box.check()
    }
  }
}

/** Takes the first allowed option of each equipment group, and the first item for a wildcard. */
export async function pickEquipment(page: Page) {
  for (const group of await page.locator('[data-testid^="equipment-group-"]').all()) {
    const radios = group.getByRole('radio')
    if ((await radios.count()) === 0) continue
    for (let i = 0; i < (await radios.count()); i++) {
      if (await radios.nth(i).isEnabled()) {
        await radios.nth(i).check()
        break
      }
    }
    for (const select of await group.getByRole('combobox').all()) {
      await select.selectOption({ index: 1 })
    }
  }
}

/** Builds Brannoch (Human Fighter, Acolyte, standard array) from the Party step and saves him. */
export async function saveFighter(page: Page) {
  await newCharacter(page)
  await fillConcept(page)
  await page.getByRole('button', { name: 'Next' }).click()
  await draftSaved(page)
  await page.getByRole('combobox', { name: 'Ability score method' }).selectOption('standard-array')
  const scores = { Strength: 15, Dexterity: 14, Constitution: 13, Intelligence: 12, Wisdom: 10 }
  for (const [ability, score] of Object.entries(scores)) {
    await page.getByRole('combobox', { name: `${ability} base score` }).selectOption(String(score))
  }
  await page.getByRole('combobox', { name: 'Charisma base score' }).selectOption('8')
  await step(page, /Skills/).click()
  await pickEveryGroup(page.locator('fieldset[data-choice-key]'))
  await step(page, /Equipment/).click()
  await pickEquipment(page)
  await step(page, /Review/).click()
  await page.getByRole('button', { name: 'Save Character' }).click()
  await expect(page).toHaveURL(/\/party$/)
}
