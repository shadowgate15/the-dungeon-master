import { expect, test, type Page } from '@playwright/test'

const row = (page: Page, name: string) => page.getByRole('row').filter({ hasText: name })

/** Creates a Campaign through the dialog. */
async function createCampaign(page: Page, name: string) {
  await page.goto('/campaigns')
  await page.waitForLoadState('networkidle') // the dialog only becomes a modal after hydration
  await page.getByRole('link', { name: 'New Campaign' }).click()
  const dialog = page.getByRole('dialog', { name: 'New Campaign' })
  await dialog.getByLabel('Name', { exact: true }).fill(name)
  await dialog.getByLabel('Premise', { exact: true }).fill('Escort a relic across the ash plains.')
  await dialog.getByLabel('Tone', { exact: true }).selectOption('tense')
  await dialog.getByLabel('Length', { exact: true }).selectOption('short')
  await dialog.getByRole('button', { name: 'Create Campaign' }).click()
  await expect(dialog).toBeHidden()
  return dialog
}

test('archives a Campaign, lists it as archived, and restores it', async ({ page }) => {
  const stamp = Date.now()
  const name = `Archive ${stamp}`
  await createCampaign(page, name)

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

test('Undo brings an archived Campaign back', async ({ page }) => {
  const stamp = Date.now()
  const name = `Undo ${stamp}`
  await createCampaign(page, name)

  await row(page, name).getByRole('button', { name: 'Archive' }).click()
  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click()
  await expect(row(page, name)).toBeVisible()
})

test('deleting needs confirmation', async ({ page }) => {
  const stamp = Date.now()
  const name = `Delete ${stamp}`
  await createCampaign(page, name)

  await row(page, name).getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText('Delete forever?')).toBeVisible()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(row(page, name)).toBeVisible()

  await row(page, name).getByRole('button', { name: 'Delete' }).click()
  await row(page, name).getByRole('button', { name: 'Confirm delete' }).click()
  await expect(page.getByRole('status')).toContainText(`Deleted ${name}`)
  await expect(row(page, name)).toHaveCount(0)
})

test('a Campaign deleted elsewhere shows a notice instead of failing', async ({
  page,
  context
}) => {
  const stamp = Date.now()
  const name = `Race ${stamp}`
  await createCampaign(page, name)
  await page.waitForLoadState('networkidle')

  const other = await context.newPage()
  await other.goto('/campaigns')
  await other.waitForLoadState('networkidle')
  await row(other, name).getByRole('button', { name: 'Delete' }).click()
  await row(other, name).getByRole('button', { name: 'Confirm delete' }).click()
  await expect(row(other, name)).toHaveCount(0)

  await row(page, name).getByRole('button', { name: 'Archive' }).click()
  await expect(page.getByRole('status')).toContainText('Campaign not found')
})
