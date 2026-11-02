import { expect, test } from '@playwright/test'
import { createWorld } from './world-helpers'

test('edits every seed field of a World from the list', async ({ page }) => {
  const name = `Edit ${Date.now()}`
  await createWorld(page, name)

  await page.getByRole('table').getByRole('link', { name }).click()
  await expect(page.getByText('0 Campaigns affected')).toBeVisible()
  await expect(page.getByLabel('Genre flavor')).toHaveValue('')

  await page.waitForLoadState('networkidle') // let hydration finish before typing
  const renamed = `${name} renamed`
  await page.getByLabel('Name', { exact: true }).fill(renamed)
  await page.getByLabel('Premise').fill('A drowned kingdom.')
  await page.getByLabel('Genre flavor').selectOption('dark fantasy')
  await page.getByLabel('Scale').selectOption('continent')
  await page.getByLabel('Magic level').selectOption('low')
  await page.getByLabel('Tech level').selectOption('renaissance')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Saved')).toBeVisible()

  await page.reload()
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue(renamed)
  await expect(page.getByLabel('Premise')).toHaveValue('A drowned kingdom.')
  await expect(page.getByLabel('Genre flavor')).toHaveValue('dark fantasy')
  await expect(page.getByLabel('Scale')).toHaveValue('continent')
  await expect(page.getByLabel('Magic level')).toHaveValue('low')
  await expect(page.getByLabel('Tech level')).toHaveValue('renaissance')
})

test('shows a validation error when the name is cleared', async ({ page }) => {
  const name = `Err ${Date.now()}`
  await createWorld(page, name)
  await page.getByRole('table').getByRole('link', { name }).click()
  await expect(page).toHaveURL(/\/edit$/)

  await page.waitForLoadState('networkidle') // let hydration finish before typing
  await page.getByLabel('Name', { exact: true }).fill('')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Name is required')).toBeVisible()
})
