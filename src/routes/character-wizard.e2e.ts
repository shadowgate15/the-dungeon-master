import { expect, test } from '@playwright/test'

async function openWizard(page: import('@playwright/test').Page) {
  await page.goto('/characters/new')
  await page.waitForLoadState('networkidle') // the draft only works after hydration
}

test('later steps stay locked until Concept is valid, then open', async ({ page }) => {
  await openWizard(page)
  const steps = page.getByRole('navigation', { name: 'Steps' })
  await expect(steps.getByRole('button', { name: /Ability scores/ })).toBeDisabled()

  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Brenna')
  await page.getByRole('combobox', { name: 'Race', exact: true }).selectOption('human')
  await page.getByRole('combobox', { name: 'Class', exact: true }).selectOption('cleric')
  await page.getByRole('combobox', { name: 'Background', exact: true }).selectOption('acolyte')

  await expect(page.getByRole('combobox', { name: 'Subclass' })).toHaveValue('life')
  await expect(steps.getByRole('button', { name: /Ability scores/ })).toBeEnabled()
  await expect(steps.getByRole('button', { name: /Review/ })).toBeDisabled()
})

test('the stats strip fills in as race and class are chosen', async ({ page }) => {
  await openWizard(page)
  const strip = page.getByRole('group', { name: 'Computed stats' })
  await expect(strip.getByRole('group', { name: 'Speed' })).toContainText('—')

  await page.getByRole('combobox', { name: 'Race', exact: true }).selectOption('human')
  await expect(strip.getByRole('group', { name: 'Speed' })).toContainText('30')
})

test('abandon asks to confirm and leaves only when confirmed', async ({ page }) => {
  await openWizard(page)
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Brenna')

  await page.getByRole('button', { name: 'Abandon', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Abandon this Character?' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Keep editing' }).click()
  await expect(page).toHaveURL(/\/characters\/new/)

  await page.getByRole('button', { name: 'Abandon', exact: true }).click()
  await dialog.getByRole('button', { name: 'Abandon', exact: true }).click()
  await expect(page).not.toHaveURL(/\/characters\/new/)
})
