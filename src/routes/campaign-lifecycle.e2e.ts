import { expect, test, type Page } from '@playwright/test'
import { createWorld } from './world-helpers'

const row = (page: Page, name: string) => page.getByRole('row').filter({ hasText: name })

/** Creates a Campaign in the given Worlds through the dialog (opened from `url`). */
async function createCampaign(page: Page, name: string, worlds: string[], url = '/campaigns') {
  await page.goto(url)
  await page.waitForLoadState('networkidle') // the dialog only becomes a modal after hydration
  await page.getByRole('link', { name: 'New Campaign' }).click()
  const dialog = page.getByRole('dialog', { name: 'New Campaign' })
  for (const world of worlds) {
    const picked = await dialog.getByRole('button', { name: `Remove ${world}` }).count()
    if (!picked) await dialog.getByLabel('Add World').selectOption({ label: world })
  }
  await dialog.getByLabel('Name', { exact: true }).fill(name)
  await dialog.getByLabel('Premise', { exact: true }).fill('Escort a relic across the ash plains.')
  await dialog.getByLabel('Tone', { exact: true }).selectOption('tense')
  await dialog.getByLabel('Length', { exact: true }).selectOption('short')
  await dialog.getByRole('button', { name: 'Create Campaign' }).click()
  await expect(dialog).toBeHidden()
  return dialog
}

async function archiveWorld(page: Page, name: string) {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await row(page, name).getByRole('button', { name: 'Archive' }).click()
  await expect(page.getByRole('status')).toContainText(`Archived ${name}`)
}

test('archives a Campaign, lists it as archived, and restores it', async ({ page }) => {
  const stamp = Date.now()
  const world = `Archworld ${stamp}`
  const name = `Archive ${stamp}`
  await createWorld(page, world)
  await createCampaign(page, name, [world])

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
  const world = `Undoworld ${stamp}`
  const name = `Undo ${stamp}`
  await createWorld(page, world)
  await createCampaign(page, name, [world])

  await row(page, name).getByRole('button', { name: 'Archive' }).click()
  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click()
  await expect(row(page, name)).toBeVisible()
})

test('deleting needs confirmation and leaves the World alone', async ({ page }) => {
  const stamp = Date.now()
  const world = `Keepworld ${stamp}`
  const name = `Delete ${stamp}`
  await createWorld(page, world)
  await createCampaign(page, name, [world])

  await row(page, name).getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText('Delete forever?')).toBeVisible()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(row(page, name)).toBeVisible()

  await row(page, name).getByRole('button', { name: 'Delete' }).click()
  await row(page, name).getByRole('button', { name: 'Confirm delete' }).click()
  await expect(page.getByRole('status')).toContainText(`Deleted ${name}`)
  await expect(row(page, name)).toHaveCount(0)

  await page.goto('/')
  await expect(row(page, world)).toBeVisible()
})

test('a Campaign deleted elsewhere shows a notice instead of failing', async ({
  page,
  context
}) => {
  const stamp = Date.now()
  const world = `Raceworld ${stamp}`
  const name = `Race ${stamp}`
  await createWorld(page, world)
  await createCampaign(page, name, [world])
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

test('an archived World makes its Campaign read-only, but the Campaign can still be archived and restored', async ({
  page
}) => {
  const stamp = Date.now()
  const world = `Dimworld ${stamp}`
  const name = `Dim ${stamp}`
  await createWorld(page, world)
  await createCampaign(page, name, [world])
  await archiveWorld(page, world)

  await page.goto('/campaigns')
  const dim = row(page, name)
  await expect(dim.getByText('Read-only', { exact: true })).toBeVisible()
  await expect(dim.getByText(`Restore ${world} to edit this Campaign.`)).toBeVisible()
  await expect(dim.getByRole('link', { name: world })).toHaveClass(/line-through/)

  await page.waitForLoadState('networkidle')
  await dim.getByRole('button', { name: 'Archive' }).click()
  await expect(row(page, name)).toHaveCount(0)
  await page.getByRole('link', { name: /^Archived/ }).click()
  await expect(row(page, name).getByText('Read-only', { exact: true })).toBeVisible()
  await row(page, name).getByRole('button', { name: 'Restore' }).click()
  await expect(row(page, name)).toHaveCount(0)
})

test('a World chip filters the list, and New Campaign pre-selects that World', async ({ page }) => {
  const stamp = Date.now()
  const ash = `Filterash ${stamp}`
  const bramble = `Filterbramble ${stamp}`
  const inAsh = `InAsh ${stamp}`
  const inBramble = `InBramble ${stamp}`
  await createWorld(page, ash)
  await createWorld(page, bramble)
  await createCampaign(page, inAsh, [ash])
  await createCampaign(page, inBramble, [bramble])

  await row(page, inAsh).getByRole('link', { name: ash }).click()
  await expect(page).toHaveURL(/world=/)
  await expect(page.getByText(`Showing Campaigns set in ${ash}`)).toBeVisible()
  await expect(row(page, inAsh)).toBeVisible()
  await expect(row(page, inBramble)).toHaveCount(0)

  await page.waitForLoadState('networkidle')
  await page.getByRole('link', { name: 'New Campaign' }).click()
  const dialog = page.getByRole('dialog', { name: 'New Campaign' })
  await expect(dialog.getByRole('button', { name: `Remove ${ash}` })).toBeVisible()
  await dialog.getByRole('link', { name: 'Close' }).click()

  await page.getByRole('link', { name: 'Clear filter' }).click()
  await expect(page).not.toHaveURL(/world=/)
  await expect(row(page, inBramble)).toBeVisible()
})

test('a filter with nothing in it says no Campaigns match', async ({ page }) => {
  const world = `Emptyworld ${Date.now()}`
  await createWorld(page, world)

  // Filter to the World, then archive its only Campaign so the filtered Active list empties.
  const campaign = `Gone ${Date.now()}`
  await createCampaign(page, campaign, [world])
  await row(page, campaign).getByRole('link', { name: world }).click()
  await page.waitForLoadState('networkidle')
  await row(page, campaign).getByRole('button', { name: 'Archive' }).click()
  await expect(page.getByText('No Campaigns match.')).toBeVisible()
})

test('a World count on the Worlds page links to its filtered Campaigns', async ({ page }) => {
  const stamp = Date.now()
  const world = `Countworld ${stamp}`
  const name = `Counted ${stamp}`
  await createWorld(page, world)
  await createCampaign(page, name, [world])

  await page.goto('/')
  await row(page, world).getByRole('link', { name: '1', exact: true }).click()
  await expect(page).toHaveURL(/\/campaigns\?world=/)
  await expect(page.getByText(`Showing Campaigns set in ${world}`)).toBeVisible()
  await expect(row(page, name)).toBeVisible()
})
