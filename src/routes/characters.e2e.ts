import { expect, test, type Page } from '@playwright/test'
import { seedCharacter } from './character-helpers'

const row = (page: Page, name: string) => page.getByRole('row').filter({ hasText: name })

test('Characters is in the section nav and shows the list with its summary line', async ({
  page
}) => {
  const name = `Lister ${Date.now()}`
  await seedCharacter(page, name)

  await page.goto('/')
  await page
    .getByRole('navigation', { name: 'Sections' })
    .getByRole('link', { name: 'Characters' })
    .click()
  await expect(page).toHaveURL(/\/characters$/)
  await expect(page.getByRole('heading', { name: 'Characters' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'New Character' })).toHaveAttribute(
    'href',
    '/characters/new'
  )

  const mine = row(page, name)
  await expect(mine).toBeVisible()
  await expect(mine.getByText('Human Fighter · Acolyte')).toBeVisible()
  await expect(mine.getByRole('cell', { name: 'Human', exact: true })).toBeVisible()
  await expect(mine.getByRole('link', { name })).toHaveAttribute('href', /\/characters\/.+/)
})

test('archives a Character, lists it as archived, and restores it', async ({ page }) => {
  const name = `Archive ${Date.now()}`
  await seedCharacter(page, name)
  await page.waitForLoadState('networkidle')

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

test('Undo brings an archived Character back', async ({ page }) => {
  const name = `Undo ${Date.now()}`
  await seedCharacter(page, name)
  await page.waitForLoadState('networkidle')

  await row(page, name).getByRole('button', { name: 'Archive' }).click()
  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click()
  await expect(row(page, name)).toBeVisible()
})

test('deleting needs confirmation', async ({ page }) => {
  const name = `Delete ${Date.now()}`
  await seedCharacter(page, name)
  await page.waitForLoadState('networkidle')

  await row(page, name).getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText('Delete forever?')).toBeVisible()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(row(page, name)).toBeVisible()

  await row(page, name).getByRole('button', { name: 'Delete' }).click()
  await row(page, name).getByRole('button', { name: 'Confirm delete' }).click()
  await expect(page.getByRole('status')).toContainText(`Deleted ${name}`)
  await expect(row(page, name)).toHaveCount(0)
})

test('a Character deleted elsewhere shows a notice instead of failing', async ({
  page,
  context
}) => {
  const name = `Race ${Date.now()}`
  await seedCharacter(page, name)
  await page.waitForLoadState('networkidle')

  const other = await context.newPage()
  await other.goto('/characters')
  await other.waitForLoadState('networkidle')
  await row(other, name).getByRole('button', { name: 'Delete' }).click()
  await row(other, name).getByRole('button', { name: 'Confirm delete' }).click()
  await expect(row(other, name)).toHaveCount(0)

  await row(page, name).getByRole('button', { name: 'Archive' }).click()
  await expect(page.getByRole('status')).toContainText('Character not found')
})
