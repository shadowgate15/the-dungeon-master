import { expect, test, type Locator, type Page } from '@playwright/test'

/** Creates a Campaign and opens its Party step. */
async function openParty(page: Page, name: string) {
  await page.goto('/campaigns')
  await page.waitForLoadState('networkidle') // the dialog only becomes a modal after hydration
  await page.getByRole('link', { name: 'New Campaign' }).click()
  const dialog = page.getByRole('dialog', { name: 'New Campaign' })
  await dialog.getByLabel('Name', { exact: true }).fill(name)
  await dialog.getByRole('button', { name: 'Create Campaign' }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  await page
    .getByRole('navigation', { name: 'Campaign creation' })
    .getByRole('link', { name: /Party/ })
    .click()
  await expect(page.getByText('No Characters yet.')).toBeVisible()
}

/** Starts a new Character draft and waits for the wizard to hydrate. */
async function newCharacter(page: Page) {
  await page.getByRole('button', { name: 'New Character' }).click()
  await expect(page).toHaveURL(/\/party\?draft=/)
  await page.waitForLoadState('networkidle')
}

const draftSaved = (page: Page) => expect(page.getByText('Draft saved')).toBeVisible()
const step = (page: Page, name: RegExp) =>
  page.getByRole('navigation', { name: 'Steps' }).getByRole('button', { name })

async function fillConcept(page: Page) {
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Brannoch')
  await page.getByRole('combobox', { name: 'Race', exact: true }).selectOption('human')
  await page.getByRole('combobox', { name: 'Class', exact: true }).selectOption('fighter')
  await page.getByRole('combobox', { name: 'Background', exact: true }).selectOption('acolyte')
}

/** Ticks the first allowed options of each choice group until none asks for more. */
async function pickEveryGroup(groups: Locator) {
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
async function pickEquipment(page: Page) {
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

test('builds a Character in a Campaign, survives a reload mid-draft and saves it into the Party', async ({
  page
}) => {
  await openParty(page, `Party Road ${Date.now()}`)
  await newCharacter(page)

  await fillConcept(page)
  await page.getByRole('button', { name: 'Next' }).click()
  await draftSaved(page)

  // Nothing is lost on reload: the draft comes back on the step it was on.
  await page.reload()
  await page.waitForLoadState('networkidle')
  const party = page.getByRole('listitem').filter({ hasText: 'Brannoch' })
  await expect(party).toContainText(/Draft.*Ability scores/)
  await expect(page.getByRole('combobox', { name: 'Ability score method' })).toBeVisible()
  await step(page, /Concept/).click()
  await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('Brannoch')
  await expect(page.getByRole('combobox', { name: 'Class', exact: true })).toHaveValue('fighter')

  await step(page, /Ability scores/).click()
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
  await expect(party).toContainText('Human Fighter, Acolyte')
  await expect(party).not.toContainText('Draft')
})

test('later steps stay locked until Concept is valid', async ({ page }) => {
  await openParty(page, `Locked Road ${Date.now()}`)
  await newCharacter(page)
  await expect(step(page, /Ability scores/)).toBeDisabled()

  await fillConcept(page)

  await expect(step(page, /Ability scores/)).toBeEnabled()
  await expect(step(page, /Review/)).toBeDisabled()
})

test('abandoning a draft asks first, then discards it', async ({ page }) => {
  await openParty(page, `Abandon Road ${Date.now()}`)
  await newCharacter(page)
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Wren')
  await draftSaved(page)

  await page.getByRole('button', { name: 'Abandon', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Abandon this Character?' })
  await dialog.getByRole('button', { name: 'Keep editing' }).click()
  await expect(page).toHaveURL(/\?draft=/)

  await page.getByRole('button', { name: 'Abandon', exact: true }).click()
  await dialog.getByRole('button', { name: 'Abandon', exact: true }).click()
  await expect(page).toHaveURL(/\/party$/)
  await expect(page.getByText('No Characters yet.')).toBeVisible()
})
