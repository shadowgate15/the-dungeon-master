import { expect, test, type Page } from '@playwright/test'
import { seedCharacter } from './character-helpers'

// The creation conversation talks to the fake LM Studio the Playwright config starts; these flows
// never send a message, so the AI is stubbed out for the whole file.

const steps = (page: Page) => page.getByRole('navigation', { name: 'Steps' })

async function openWizard(page: Page, url: string) {
  await page.goto(url)
  await page.waitForLoadState('networkidle') // the draft only works after hydration
}

/** Fills Skills & features by taking the first free option of every choice group. */
async function fillSkills(page: Page) {
  await steps(page)
    .getByRole('button', { name: /Skills & features/ })
    .click()
  const groups = page.locator('fieldset[data-choice-key]')
  for (const key of await groups.evaluateAll((els) =>
    els.map((e) => e.getAttribute('data-choice-key')!)
  )) {
    const group = page.locator(`fieldset[data-choice-key="${key}"]`)
    const need = Number((await group.locator('legend').innerText()).match(/of (\d+)/)![1])
    for (let n = 0; n < need; n++) {
      await group.locator('input[type=checkbox]:enabled:not(:checked)').first().check()
    }
  }
}

/** Takes the first option of every equipment group and the first item of every wildcard. */
async function fillEquipment(page: Page) {
  await steps(page)
    .getByRole('button', { name: /Equipment/ })
    .click()
  const groups = page.locator('[data-testid^="equipment-group-"]')
  for (let g = 0; g < (await groups.count()); g++) {
    const group = groups.nth(g)
    await group.getByRole('radio').first().check()
    const selects = group.getByRole('combobox')
    for (let s = 0; s < (await selects.count()); s++) {
      await selects.nth(s).selectOption({ index: 1 })
    }
  }
}

async function createFighter(page: Page, name: string) {
  await openWizard(page, '/characters/new')
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill(name)
  await page.getByRole('combobox', { name: 'Race', exact: true }).selectOption('human')
  await page.getByRole('combobox', { name: 'Class', exact: true }).selectOption('fighter')
  await page.getByRole('combobox', { name: 'Background', exact: true }).selectOption('acolyte')

  await steps(page)
    .getByRole('button', { name: /Ability scores/ })
    .click()
  await page.getByRole('radio', { name: /Standard array/ }).check()
  const scores = {
    Strength: '15',
    Dexterity: '14',
    Constitution: '13',
    Intelligence: '12',
    Wisdom: '10',
    Charisma: '8'
  }
  for (const [ability, value] of Object.entries(scores)) {
    await page.getByRole('combobox', { name: `${ability} base score` }).selectOption(value)
  }

  await fillSkills(page)
  await fillEquipment(page)
  await steps(page)
    .getByRole('button', { name: /Review/ })
    .click()
  await page.getByRole('button', { name: 'Save Character' }).click()
  await expect(page).toHaveURL(/\/characters\/[^/?]+(\?saved)?$/)
  await expect(page.getByRole('status')).toContainText(`Saved ${name}`)
}

test('creates, edits and deletes a Character end to end', async ({ page }) => {
  const stamp = Date.now()
  const name = `Flow ${stamp}`
  await createFighter(page, name)
  await expect(page.getByRole('heading', { name, level: 2 })).toBeVisible()

  // Edit: prefilled, every step already valid, and saving lands back on the summary.
  await page.getByRole('link', { name: 'Edit', exact: true }).click()
  await expect(page).toHaveURL(/\/characters\/[^/]+\/edit$/)
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue(name)
  for (const label of ['Concept', 'Ability scores', 'Skills & features', 'Equipment', 'Review']) {
    await expect(
      steps(page).getByRole('button', { name: new RegExp(`${label}\\s*, valid`) })
    ).toBeVisible()
  }

  const renamed = `${name} renamed`
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill(renamed)
  await steps(page)
    .getByRole('button', { name: /Review/ })
    .click()
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page).toHaveURL(/\/characters\/[^/?]+(\?saved)?$/)
  await expect(page.getByRole('status')).toContainText(`Saved ${renamed}`)
  await expect(page.getByRole('heading', { name: renamed, level: 2 })).toBeVisible()

  // Delete from the list, confirmed inline.
  await page.goto('/characters')
  await page.waitForLoadState('networkidle')
  const row = page.getByRole('row').filter({ hasText: renamed })
  await expect(row.getByText('Human Fighter · Acolyte')).toBeVisible()
  await row.getByRole('button', { name: 'Delete' }).click()
  await row.getByRole('button', { name: 'Confirm delete' }).click()
  await expect(page.getByRole('row').filter({ hasText: renamed })).toHaveCount(0)
})

const withHolySymbol = [
  { choiceKey: 'class/fighter/equipment-0', item: 'chain-mail' },
  { choiceKey: 'class/fighter/equipment-1', item: 'longsword' },
  { choiceKey: 'class/fighter/equipment-1', item: 'shield' },
  { choiceKey: 'class/fighter/equipment-2', item: 'crossbow-light' },
  { choiceKey: 'class/fighter/equipment-2', item: 'crossbow-bolt', quantity: 20 },
  { choiceKey: 'class/fighter/equipment-3', item: 'dungeoneers-pack' },
  { choiceKey: 'background/acolyte/equipment-0', item: 'amulet' }
]

test('a changed race keeps a conflicting pick and flags it; a changed class clears and says so', async ({
  page
}) => {
  const created = await seedCharacter(page, `Reconcile ${Date.now()}`, {
    equipment: withHolySymbol
  })
  await openWizard(page, `/characters/${created.id}/edit`)

  // Elves already know Elvish, so the Acolyte's Elvish pick is kept and flagged, not dropped.
  await page.getByRole('combobox', { name: 'Race', exact: true }).selectOption('elf')
  await page.getByRole('combobox', { name: 'Subrace', exact: true }).selectOption('high-elf')
  await expect(
    steps(page).getByRole('button', { name: /Skills & features\s*, needs attention/ })
  ).toBeVisible()
  await expect(steps(page).getByRole('button', { name: /Review/ })).toBeDisabled()
  // The race's own picks are cleared with a notice.
  await expect(page.getByText(/Cleared your Human choices/)).toBeVisible()

  // Switching class clears the Fighter picks and equipment and says so.
  await page.getByRole('combobox', { name: 'Class', exact: true }).selectOption('cleric')
  await expect(page.getByText('Cleared your Fighter choices: they no longer apply.')).toBeVisible()
  await expect(
    page.getByText('Cleared your Fighter equipment choices: they no longer apply.')
  ).toBeVisible()
})

test('leaving with unsaved changes asks to discard, in-app and on tab close', async ({ page }) => {
  const created = await seedCharacter(page, `Discard ${Date.now()}`, { equipment: withHolySymbol })
  await page.goto(`/characters/${created.id}`)
  await page.getByRole('link', { name: 'Edit', exact: true }).click()
  await page.waitForLoadState('networkidle')

  // Untouched: leaving is free.
  await page.goBack()
  await expect(page).toHaveURL(new RegExp(`/characters/${created.id}$`))
  await page.getByRole('link', { name: 'Edit', exact: true }).click()
  await page.waitForLoadState('networkidle')

  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Changed my mind')
  await page.goBack()
  const dialog = page.getByRole('dialog', { name: 'Discard this Character?' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Keep editing' }).click()
  await expect(page).toHaveURL(/\/edit$/)
  await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue(
    'Changed my mind'
  )

  await page.goBack()
  await dialog.getByRole('button', { name: 'Discard' }).click()
  await expect(page).toHaveURL(new RegExp(`/characters/${created.id}$`))

  // Closing the tab raises the browser's own confirm.
  await page.getByRole('link', { name: 'Edit', exact: true }).click()
  await page.waitForLoadState('networkidle')
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Changed again')
  const prompted = page.waitForEvent('dialog')
  await page.close({ runBeforeUnload: true })
  const confirm = await prompted
  expect(confirm.type()).toBe('beforeunload')
  await confirm.dismiss()
})

test('an archived Character sends the edit URL back to its summary', async ({ page }) => {
  const name = `Archived edit ${Date.now()}`
  const created = await seedCharacter(page, name)
  await page.waitForLoadState('networkidle')
  await page
    .getByRole('row')
    .filter({ hasText: name })
    .getByRole('button', { name: 'Archive' })
    .click()
  await expect(page.getByRole('status')).toContainText(`Archived ${name}`)

  await page.goto(`/characters/${created.id}/edit`)
  await expect(page).toHaveURL(new RegExp(`/characters/${created.id}$`))
  await expect(page.getByText('This Character is archived')).toBeVisible()
})

test('editing a stale id is a 404', async ({ page }) => {
  const response = await page.goto('/characters/does-not-exist/edit')
  expect(response?.status()).toBe(404)
})
