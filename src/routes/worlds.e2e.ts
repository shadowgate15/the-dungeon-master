import { expect, test } from '@playwright/test'
import { openNewWorld } from './world-helpers'

test('creates a World by hand with no AI configured', async ({ page }) => {
  const name = `Eldoria ${Date.now()}`
  await openNewWorld(page)

  await page.getByRole('button', { name: 'Create World' }).click()
  await expect(page.getByText('Name is required')).toBeVisible()

  await page.getByLabel('Name', { exact: true }).fill(name)
  await page.getByRole('button', { name: 'Create World' }).click()

  await expect(page.getByRole('table').getByText(name)).toBeVisible()
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('')
})

test('creates a World with every seed field set', async ({ page }) => {
  const name = `Full ${Date.now()}`
  await openNewWorld(page)

  await page.getByLabel('Name', { exact: true }).fill(name)
  await page.getByLabel('Premise', { exact: true }).fill('A drowned kingdom.')
  await page.getByLabel('Genre flavor', { exact: true }).selectOption('dark fantasy')
  await page.getByLabel('Scale', { exact: true }).selectOption('continent')
  await page.getByLabel('Magic level', { exact: true }).selectOption('low')
  await page.getByLabel('Tech level', { exact: true }).selectOption('renaissance')
  await page.getByRole('button', { name: 'Create World' }).click()

  await expect(page.getByRole('table').getByText(name)).toBeVisible()
  await expect(page.getByLabel('Premise', { exact: true })).toHaveValue('')
})

test('enum pickers start unset and a World can be created from just a name', async ({ page }) => {
  const name = `Bare ${Date.now()}`
  await openNewWorld(page)

  for (const label of ['Genre flavor', 'Scale', 'Magic level', 'Tech level']) {
    await expect(page.getByLabel(label, { exact: true })).toHaveValue('')
  }

  await page.getByLabel('Name', { exact: true }).fill(name)
  await page.getByRole('button', { name: 'Create World' }).click()
  await expect(page.getByRole('table').getByText(name)).toBeVisible()
})

test('genre flavor and tech level are independent', async ({ page }) => {
  const name = `Odd ${Date.now()}`
  await openNewWorld(page)

  await page.getByLabel('Name', { exact: true }).fill(name)
  await page.getByLabel('Genre flavor', { exact: true }).selectOption('high fantasy')
  await page.getByLabel('Tech level', { exact: true }).selectOption('futuristic')
  await page.getByRole('button', { name: 'Create World' }).click()

  await expect(page.getByRole('table').getByText(name)).toBeVisible()
})

test('warns when the premise passes the soft cap but still allows creating', async ({ page }) => {
  const name = `Long ${Date.now()}`
  await openNewWorld(page)

  await page.getByLabel('Name', { exact: true }).fill(name)
  await page.getByLabel('Premise', { exact: true }).fill('x'.repeat(500))
  await expect(page.getByText(/premise is long/i)).toBeHidden()

  await page.getByLabel('Premise', { exact: true }).fill('x'.repeat(501))
  await expect(page.getByText(/premise is long/i)).toBeVisible()

  await page.getByRole('button', { name: 'Create World' }).click()
  await expect(page.getByRole('table').getByText(name)).toBeVisible()
})
