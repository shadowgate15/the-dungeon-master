import { expect, test, type Page } from '@playwright/test'
import { createWorld } from './world-helpers'

async function createCampaign(page: Page, name: string, worldNames: string[]) {
  await page.goto('/campaigns')
  await page.waitForLoadState('networkidle') // the dialog only becomes a modal after hydration
  await page.getByRole('link', { name: 'New Campaign' }).click()
  const dialog = page.getByRole('dialog', { name: 'New Campaign' })
  for (const worldName of worldNames) {
    await dialog.getByLabel('Add World').selectOption({ label: worldName })
  }
  await dialog.getByLabel('Name', { exact: true }).fill(name)
  await dialog.getByLabel('Premise').fill('Escort a relic across the ash plains.')
  await dialog.getByLabel('Tone').selectOption('tense')
  await dialog.getByLabel('Length').selectOption('short')
  await dialog.getByRole('button', { name: 'Create Campaign' }).click()
  await expect(dialog).toBeHidden()
}

async function openEdit(page: Page, name: string) {
  await page.getByRole('table').getByRole('link', { name }).click()
  await expect(page).toHaveURL(/\/campaigns\/.+\/edit$/)
  await page.waitForLoadState('networkidle') // let hydration finish before typing
}

test('edits every field and the World set, and the table reflects it', async ({ page }) => {
  const stamp = Date.now()
  const first = `Edfirst ${stamp}`
  const second = `Edsecond ${stamp}`
  const name = `Edit Road ${stamp}`
  await createWorld(page, first)
  await createWorld(page, second)
  await createCampaign(page, name, [first])

  await openEdit(page, name)
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue(name)
  await expect(page.getByLabel('Tone')).toHaveValue('tense')
  // The last World cannot be removed.
  await expect(page.getByRole('button', { name: `Remove ${first}` })).toBeDisabled()

  const renamed = `${name} renamed`
  await page.getByLabel('Add World').selectOption({ label: second })
  await page.getByRole('button', { name: `Remove ${first}` }).click()
  await page.getByLabel('Name', { exact: true }).fill(renamed)
  await page.getByLabel('Premise').fill('A new hook.')
  await page.getByLabel('Tone').selectOption('dark')
  await page.getByLabel('Length').selectOption('long')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Saved')).toBeVisible()

  await page.getByRole('link', { name: 'Back to Campaigns' }).click()
  const row = page.getByRole('row', { name: new RegExp(renamed) })
  await expect(row.getByText(second)).toBeVisible()
  await expect(row.getByText(first)).toHaveCount(0)
  await expect(row.getByRole('cell', { name: 'dark', exact: true })).toBeVisible()
  await expect(row.getByRole('cell', { name: 'long', exact: true })).toBeVisible()
})

test('a long premise warns but saves; a blank name shows an inline error', async ({ page }) => {
  const stamp = Date.now()
  const worldName = `Edlong ${stamp}`
  const name = `Edlong Road ${stamp}`
  await createWorld(page, worldName)
  await createCampaign(page, name, [worldName])

  await openEdit(page, name)
  await page.getByLabel('Premise').fill('x'.repeat(520))
  await expect(page.getByText(/Premise is long/)).toBeVisible()
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Saved')).toBeVisible()

  await page.getByLabel('Name', { exact: true }).fill('')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('alert')).toContainText('Name is required')
})

test('a read-only Campaign names its blocking Worlds and is editable once restored', async ({
  page
}) => {
  const stamp = Date.now()
  const worldName = `Edblock ${stamp}`
  const name = `Edblock Road ${stamp}`
  await createWorld(page, worldName)
  await createCampaign(page, name, [worldName])

  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page
    .getByRole('row', { name: new RegExp(worldName) })
    .getByRole('button', { name: 'Archive' })
    .click()
  await expect(page.getByRole('row', { name: new RegExp(worldName) })).toHaveCount(0)

  await page.goto('/campaigns')
  await openEdit(page, name)
  await expect(page.getByText(/read-only/)).toBeVisible()
  await expect(page.getByText(worldName)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0)
  await expect(page.getByLabel('Name', { exact: true })).toHaveCount(0)

  await page.goto('/?view=archived')
  await page.waitForLoadState('networkidle')
  await page
    .getByRole('row', { name: new RegExp(worldName) })
    .getByRole('button', { name: 'Restore' })
    .click()
  await expect(page.getByRole('row', { name: new RegExp(worldName) })).toHaveCount(0)

  await page.goto('/campaigns')
  await openEdit(page, name)
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeVisible()
})

test('an unknown Campaign is a 404', async ({ page }) => {
  const response = await page.goto('/campaigns/does-not-exist/edit')
  expect(response?.status()).toBe(404)
})
