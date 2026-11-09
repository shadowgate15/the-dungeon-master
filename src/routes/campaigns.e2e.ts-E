import { expect, test, type Page } from '@playwright/test'
import { createWorld } from './world-helpers'

async function openNewCampaign(page: Page) {
  await page.goto('/campaigns')
  await page.waitForLoadState('networkidle') // the dialog only becomes a modal after hydration
  await page.getByRole('link', { name: 'New Campaign' }).click()
  return page.getByRole('dialog', { name: 'New Campaign' })
}

test('Worlds and Campaigns link to each other from both pages', async ({ page }) => {
  await page.goto('/')
  await page
    .getByRole('navigation', { name: 'Sections' })
    .getByRole('link', { name: 'Campaigns' })
    .click()
  await expect(page.getByRole('heading', { name: 'Campaigns' })).toBeVisible()
  await page
    .getByRole('navigation', { name: 'Sections' })
    .getByRole('link', { name: 'Worlds' })
    .click()
  await expect(page.getByRole('heading', { name: 'Worlds' })).toBeVisible()
})

test('creates a Campaign in the dialog and lists it with its Worlds', async ({ page }) => {
  const stamp = Date.now()
  const worldName = `Ashfall ${stamp}`
  const name = `Ember Road ${stamp}`
  await createWorld(page, worldName)

  const dialog = await openNewCampaign(page)
  const create = dialog.getByRole('button', { name: 'Create Campaign' })
  await expect(create).toBeDisabled()
  await expect(dialog.getByText('A Campaign needs at least one World')).toBeVisible()

  await dialog.getByLabel('Add World').selectOption({ label: worldName })
  await dialog.getByLabel('Name', { exact: true }).fill(name)
  await dialog.getByLabel('Premise').fill('Escort a relic across the ash plains.')
  await dialog.getByLabel('Tone').selectOption('tense')
  await expect(create).toBeDisabled()
  await dialog.getByLabel('Length').selectOption('short')
  await expect(create).toBeEnabled()
  await create.click()

  await expect(dialog).toBeHidden()
  const row = page.getByRole('row', { name: new RegExp(name) })
  await expect(row.getByText(worldName)).toBeVisible()
  await expect(row.getByRole('cell', { name: 'tense', exact: true })).toBeVisible()
})

test('a long premise warns but still saves', async ({ page }) => {
  const stamp = Date.now()
  const worldName = `Longworld ${stamp}`
  const name = `Long ${stamp}`
  await createWorld(page, worldName)

  const dialog = await openNewCampaign(page)
  await dialog.getByLabel('Add World').selectOption({ label: worldName })
  await dialog.getByLabel('Name', { exact: true }).fill(name)
  await dialog.getByLabel('Premise').fill('x'.repeat(520))
  await dialog.getByLabel('Tone').selectOption('epic')
  await dialog.getByLabel('Length').selectOption('long')
  await expect(dialog.getByText(/Premise is long/)).toBeVisible()
  await dialog.getByRole('button', { name: 'Create Campaign' }).click()

  await expect(page.getByRole('row', { name: new RegExp(name) })).toBeVisible()
})

test('the picker locks the last chip', async ({ page }) => {
  const worldName = `Locked ${Date.now()}`
  await createWorld(page, worldName)

  const dialog = await openNewCampaign(page)
  await dialog.getByLabel('Add World').selectOption({ label: worldName })

  await expect(dialog.getByRole('button', { name: `Remove ${worldName}` })).toBeDisabled()
  await expect(dialog.getByText(/last World can't be removed/)).toBeVisible()
})
