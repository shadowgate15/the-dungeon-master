import { expect, test, type Page } from '@playwright/test'

async function createWorld(page: Page, name: string) {
  await page.goto('/')
  await page.waitForLoadState('networkidle') // let hydration finish before typing
  await page.getByLabel('Name').fill(name)
  await page.getByRole('button', { name: 'Create World' }).click()
  await page.getByRole('list', { name: 'Worlds' }).getByRole('link', { name }).click()
  await page.waitForLoadState('networkidle')
}

test('archives a World, hides it, shows it read-only, and restores it', async ({ page }) => {
  const name = `Archive ${Date.now()}`
  await createWorld(page, name)

  await page.getByRole('button', { name: 'Archive World' }).click()
  await expect(page.getByRole('heading', { name: 'Worlds' })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Worlds' }).getByText(name)).toHaveCount(0)

  await page.getByRole('link', { name: 'Archived Worlds' }).click()
  await page.getByRole('list', { name: 'Archived Worlds' }).getByRole('link', { name }).click()
  await expect(page.getByText('archived and read-only')).toBeVisible()
  await expect(page.getByLabel('Name')).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0)

  await page.getByRole('link', { name: 'Back to Worlds' }).click()
  await page.getByRole('link', { name: 'Archived Worlds' }).click()
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: `Restore ${name}` }).click()
  await expect(page.getByRole('list', { name: 'Archived Worlds' }).getByText(name)).toHaveCount(0)

  await page.getByRole('link', { name: 'Back to Worlds' }).click()
  await expect(page.getByRole('list', { name: 'Worlds' }).getByText(name)).toBeVisible()
})

test('deletes an unreferenced World only after confirmation', async ({ page }) => {
  const name = `Delete ${Date.now()}`
  await createWorld(page, name)

  await page.getByRole('button', { name: 'Delete World' }).click()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('button', { name: 'Delete World' })).toBeVisible()

  await page.getByRole('button', { name: 'Delete World' }).click()
  await page.getByRole('button', { name: 'Confirm delete' }).click()
  await expect(page.getByRole('heading', { name: 'Worlds' })).toBeVisible()
  await expect(page.getByText(name)).toHaveCount(0)
})
