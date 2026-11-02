import { expect, test, type Page } from '@playwright/test'
import { createWorld } from './world-helpers'

const row = (page: Page, name: string) => page.getByRole('row').filter({ hasText: name })

async function showArchived(page: Page) {
  await page.getByRole('link', { name: /^Archived/ }).click()
  await expect(page).toHaveURL(/view=archived/)
}

test('archives a World, hides it, shows it read-only, and restores it', async ({ page }) => {
  const name = `Archive ${Date.now()}`
  await createWorld(page, name)

  await row(page, name).getByRole('button', { name: 'Archive' }).click()
  await expect(page.getByRole('status')).toContainText(`Archived ${name}`)
  await expect(row(page, name)).toHaveCount(0)

  await showArchived(page)
  await page.getByRole('table').getByRole('link', { name }).click()
  await expect(page.getByText('archived and read-only')).toBeVisible()
  await expect(page.getByLabel('Name', { exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0)

  await page.getByRole('link', { name: 'Back to Worlds' }).click()
  await page.waitForLoadState('networkidle')
  await showArchived(page)
  await row(page, name).getByRole('button', { name: 'Restore' }).click()
  await expect(row(page, name)).toHaveCount(0)

  await page.getByRole('link', { name: /^Active/ }).click()
  await expect(row(page, name)).toBeVisible()
})

test('Undo brings an archived World back', async ({ page }) => {
  const name = `Undo ${Date.now()}`
  await createWorld(page, name)

  await row(page, name).getByRole('button', { name: 'Archive' }).click()
  await expect(row(page, name)).toHaveCount(0)
  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click()

  await expect(row(page, name)).toBeVisible()
  await expect(page.getByRole('status')).toContainText(`Restored ${name}`)
})

test('archives and restores several Worlds at once', async ({ page }) => {
  const stamp = Date.now()
  const names = [`BulkA ${stamp}`, `BulkB ${stamp}`]
  for (const name of names) await createWorld(page, name)

  for (const name of names) await page.getByLabel(`Select ${name}`).check()
  await expect(page.getByText('2 selected')).toBeVisible()
  await page.getByRole('button', { name: 'Archive selected' }).click()
  await expect(page.getByRole('status')).toContainText('Archived 2 Worlds')
  for (const name of names) await expect(row(page, name)).toHaveCount(0)

  await showArchived(page)
  for (const name of names) await page.getByLabel(`Select ${name}`).check()
  await page.getByRole('button', { name: 'Restore selected' }).click()
  await expect(page.getByRole('status')).toContainText('Restored 2 Worlds')
  for (const name of names) await expect(row(page, name)).toHaveCount(0)
})

test('deletes an unreferenced World only after confirmation', async ({ page }) => {
  const name = `Delete ${Date.now()}`
  await createWorld(page, name)

  await row(page, name).getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(row(page, name)).toBeVisible()

  await row(page, name).getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('button', { name: 'Confirm delete' }).click()
  await expect(page.getByRole('status')).toContainText(`Deleted ${name}`)
  await expect(row(page, name)).toHaveCount(0)
})

test('deletes an unreferenced World from its edit page', async ({ page }) => {
  const name = `EditDelete ${Date.now()}`
  await createWorld(page, name)
  await page.getByRole('table').getByRole('link', { name }).click()
  await page.waitForLoadState('networkidle')

  await page.getByRole('button', { name: 'Delete World' }).click()
  await page.getByRole('button', { name: 'Confirm delete' }).click()
  await expect(page.getByRole('heading', { name: 'Worlds' })).toBeVisible()
  await expect(page.getByText(name)).toHaveCount(0)
})

test('deletes an archived unreferenced World from its edit page', async ({ page }) => {
  const name = `ArchDelete ${Date.now()}`
  await createWorld(page, name)
  await row(page, name).getByRole('button', { name: 'Archive' }).click()
  await expect(row(page, name)).toHaveCount(0)
  await showArchived(page)
  await page.getByRole('table').getByRole('link', { name }).click()
  await page.waitForLoadState('networkidle')

  await page.getByRole('button', { name: 'Delete World' }).click()
  await page.getByRole('button', { name: 'Confirm delete' }).click()
  await expect(page.getByRole('heading', { name: 'Worlds' })).toBeVisible()
  await page.goto('/?view=archived')
  await expect(page.getByText(name)).toHaveCount(0)
})

test('filters the table by search text', async ({ page }) => {
  const stamp = Date.now()
  const [keep, hide] = [`Findme ${stamp}`, `Other ${stamp}`]
  await createWorld(page, keep)
  await createWorld(page, hide)

  await page.getByLabel('Search Worlds').fill(`Findme ${stamp}`)
  await expect(row(page, keep)).toBeVisible()
  await expect(row(page, hide)).toHaveCount(0)
})

test('the old archived URL lands on the Archived view', async ({ page }) => {
  await page.goto('/worlds/archived')
  await expect(page).toHaveURL(/\/\?view=archived/)
  await expect(page.getByRole('link', { name: /^Archived/ })).toHaveAttribute(
    'aria-current',
    'page'
  )
})
