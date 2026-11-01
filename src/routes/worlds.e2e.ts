import { expect, test } from '@playwright/test'

test('creates a World by hand with no AI configured', async ({ page }) => {
  const name = `Eldoria ${Date.now()}`
  await page.goto('/')

  await page.getByRole('button', { name: 'Create World' }).click()
  await expect(page.getByText('Name is required')).toBeVisible()

  await page.getByLabel('Name').fill(name)
  await page.getByRole('button', { name: 'Create World' }).click()

  await expect(page.getByRole('list', { name: 'Worlds' }).getByText(name)).toBeVisible()
  await expect(page.getByLabel('Name')).toHaveValue('')
})
