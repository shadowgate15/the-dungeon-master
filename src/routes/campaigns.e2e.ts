import { expect, test, type Page } from '@playwright/test'

async function openNewCampaign(page: Page) {
  await page.goto('/campaigns')
  await page.waitForLoadState('networkidle') // the dialog only becomes a modal after hydration
  await page.getByRole('link', { name: 'New Campaign' }).click()
  return page.getByRole('dialog', { name: 'New Campaign' })
}

test('the home page is the Campaign library', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/campaigns$/)
  await expect(page.getByRole('heading', { name: 'Campaigns' })).toBeVisible()
})

test('creates a Campaign by hand in the dialog and lists it', async ({ page }) => {
  const name = `Ember Road ${Date.now()}`

  const dialog = await openNewCampaign(page)
  await expect(dialog.getByRole('button', { name: /Generate|feedback/ })).toHaveCount(0)
  const create = dialog.getByRole('button', { name: 'Create Campaign' })
  await expect(create).toBeDisabled()

  await dialog.getByLabel('Name', { exact: true }).fill(name)
  await dialog.getByLabel('Premise', { exact: true }).fill('Escort a relic across the ash plains.')
  await dialog.getByLabel('Tone', { exact: true }).selectOption('tense')
  await expect(create).toBeDisabled()
  await dialog.getByLabel('Length', { exact: true }).selectOption('short')
  await expect(create).toBeEnabled()
  await create.click()

  await expect(dialog).toBeHidden()
  const row = page.getByRole('row', { name: new RegExp(name) })
  await expect(row.getByRole('cell', { name: 'tense', exact: true })).toBeVisible()
})

test('a long premise warns but still saves', async ({ page }) => {
  const name = `Long ${Date.now()}`

  const dialog = await openNewCampaign(page)
  await dialog.getByLabel('Name', { exact: true }).fill(name)
  await dialog.getByLabel('Premise', { exact: true }).fill('x'.repeat(520))
  await dialog.getByLabel('Tone', { exact: true }).selectOption('epic')
  await dialog.getByLabel('Length', { exact: true }).selectOption('long')
  await expect(dialog.getByText(/Premise is long/)).toBeVisible()
  await dialog.getByRole('button', { name: 'Create Campaign' }).click()

  await expect(page.getByRole('row', { name: new RegExp(name) })).toBeVisible()
})
