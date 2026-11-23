import fs from 'node:fs'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { E2E_CAMPAIGNS } from '../../playwright.config'

const row = (page: Page, name: string) => page.getByRole('row').filter({ hasText: name })

async function openNewCampaign(page: Page) {
  await page.goto('/campaigns')
  await page.waitForLoadState('networkidle') // the dialog only becomes a modal after hydration
  await page.getByRole('link', { name: 'New Campaign' }).click()
  return page.getByRole('dialog', { name: 'New Campaign' })
}

/** Creates a Campaign through the dialog, landing on its Campaign page. */
async function createCampaign(page: Page, name: string) {
  const dialog = await openNewCampaign(page)
  await dialog.getByLabel('Name', { exact: true }).fill(name)
  await dialog.getByRole('button', { name: 'Create Campaign' }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
}

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-')

test('the home page is the Campaign library', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/campaigns$/)
  await expect(page.getByRole('heading', { name: 'Campaigns' })).toBeVisible()
})

test('creates a Campaign in its own folder and fills its Seed', async ({ page }) => {
  const name = `Ember Road ${Date.now()}`
  const folder = path.join(E2E_CAMPAIGNS, slug(name))

  const dialog = await openNewCampaign(page)
  const create = dialog.getByRole('button', { name: 'Create Campaign' })
  await expect(create).toBeDisabled()
  await dialog.getByLabel('Name', { exact: true }).fill(name)
  await expect(dialog.getByLabel('Folder')).toHaveValue(folder)
  await create.click()

  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  expect(fs.existsSync(path.join(folder, '.dm', 'campaign.db'))).toBe(true)
  await expect(page.getByRole('navigation', { name: 'Campaign creation' })).toContainText(
    /1\.\s*Seed.*2\.\s*Party.*3\.\s*Begin/
  )

  const seed = page.getByRole('region', { name: 'Seed' })
  await expect(seed.getByRole('status')).toHaveText(
    'Seed incomplete: still needs Premise, Tone and Length.'
  )
  await seed.getByLabel('Premise').fill('Escort a relic across the ash plains.')
  await seed.getByLabel('Tone').selectOption('tense')
  await seed.getByLabel('Length').selectOption('short')
  await seed.getByLabel('World name').fill('Varn')
  await seed.getByLabel('Genre flavor').selectOption('dark fantasy')
  await seed.getByLabel('Scale').selectOption('single region')
  await seed.getByLabel('Magic level').selectOption('low')
  await seed.getByLabel('Tech level').selectOption('medieval')
  await expect(seed.getByRole('status')).toHaveText('Seed complete')
  await seed.getByRole('button', { name: 'Save Seed' }).click()
  await expect(seed.getByText('Saved')).toBeVisible()

  await page.reload()
  await expect(seed.getByLabel('Premise')).toHaveValue('Escort a relic across the ash plains.')
  await expect(seed.getByLabel('Tech level')).toHaveValue('medieval')
  await expect(seed.getByRole('status')).toHaveText('Seed complete')

  await page.getByRole('link', { name: 'All Campaigns' }).click()
  await expect(row(page, name).getByRole('cell', { name: 'tense', exact: true })).toBeVisible()
})

test('archives a Campaign, lists it as archived, and restores it', async ({ page }) => {
  const name = `Archive ${Date.now()}`
  await createCampaign(page, name)
  await page.goto('/campaigns')

  await row(page, name).getByRole('button', { name: 'Archive' }).click()
  await expect(page.getByRole('status')).toContainText(`Archived ${name}`)
  await expect(row(page, name)).toHaveCount(0)

  await page.getByRole('link', { name: /^Archived/ }).click()
  await expect(page).toHaveURL(/view=archived/)
  await row(page, name).getByRole('button', { name: 'Restore' }).click()
  await expect(row(page, name)).toHaveCount(0)

  await page.getByRole('link', { name: /^Active/ }).click()
  await expect(row(page, name)).toBeVisible()
})

test('deleting needs confirmation and removes the folder', async ({ page }) => {
  const name = `Delete ${Date.now()}`
  await createCampaign(page, name)
  await page.goto('/campaigns')

  await row(page, name).getByRole('button', { name: 'Delete' }).click()
  await row(page, name).getByRole('button', { name: 'Cancel' }).click()
  await expect(row(page, name)).toBeVisible()

  await row(page, name).getByRole('button', { name: 'Delete' }).click()
  await row(page, name).getByRole('button', { name: 'Confirm delete' }).click()
  await expect(page.getByRole('status')).toContainText(`Deleted ${name}`)
  await expect(row(page, name)).toHaveCount(0)
  expect(fs.existsSync(path.join(E2E_CAMPAIGNS, slug(name)))).toBe(false)
})

test('a moved folder shows as Missing until it is re-added', async ({ page }) => {
  const name = `Moved ${Date.now()}`
  await createCampaign(page, name)
  const moved = path.join(E2E_CAMPAIGNS, `${slug(name)}-moved`)
  fs.renameSync(path.join(E2E_CAMPAIGNS, slug(name)), moved)

  await page.goto('/campaigns')
  await page.waitForLoadState('networkidle')
  await expect(row(page, name).getByText('Missing', { exact: true })).toBeVisible()

  await row(page, name).getByRole('button', { name: 'Re-add' }).click()
  await row(page, name).getByLabel('Campaign folder').fill(moved)
  await row(page, name).getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByRole('status')).toContainText(`Added ${name}`)
  await expect(row(page, name).getByRole('link', { name })).toBeVisible()
})

test('removing a Campaign from the library keeps its folder', async ({ page }) => {
  const name = `Remove ${Date.now()}`
  await createCampaign(page, name)
  await page.goto('/campaigns')

  await row(page, name).getByRole('button', { name: 'Remove from library' }).click()
  await expect(page.getByRole('status')).toContainText(`Removed ${name} from the library`)
  await expect(row(page, name)).toHaveCount(0)
  expect(fs.existsSync(path.join(E2E_CAMPAIGNS, slug(name), '.dm', 'campaign.db'))).toBe(true)
})
