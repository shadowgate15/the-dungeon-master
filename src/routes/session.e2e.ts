import { expect, test, type Page } from '@playwright/test'
import { startFakeDm } from '../testing/fake-dm'
import { E2E_HOME } from '../../playwright.config'

async function createCampaign(page: Page, name: string): Promise<string> {
  await page.goto('/campaigns')
  await page.waitForLoadState('networkidle')
  await page.getByRole('link', { name: 'New Campaign' }).click()
  const dialog = page.getByRole('dialog', { name: 'New Campaign' })
  await dialog.getByLabel('Name', { exact: true }).fill(name)
  const folder = await dialog.getByLabel('Folder').inputValue()
  await dialog.getByRole('button', { name: 'Create Campaign' }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  return folder
}

test('the DM badge flips live as a session attaches and leaves', async ({ page, context }) => {
  const name = `Badge Watch ${Date.now()}`
  const folder = await createCampaign(page, name)
  const header = page.locator('header').filter({ has: page.getByRole('heading', { name }) })
  await expect(header.getByText('DM away')).toBeVisible()

  const library = await context.newPage()
  await library.goto('/campaigns')
  const row = library.getByRole('row', { name: new RegExp(name) })
  await expect(row.getByText('DM away')).toBeVisible()

  const dm = await startFakeDm({ folder, home: E2E_HOME })
  try {
    await expect(header.getByText('DM at the table')).toBeVisible()
    await expect(row.getByText('DM at the table')).toBeVisible()
    await dm.close()
  } finally {
    await dm.kill()
  }
  await expect(header.getByText('DM away')).toBeVisible()
  await expect(row.getByText('DM away')).toBeVisible()
})

test('a second session is refused for the same Campaign', async ({ page }) => {
  const name = `Second Seat ${Date.now()}`
  const folder = await createCampaign(page, name)

  const first = await startFakeDm({ folder, home: E2E_HOME })
  const second = await startFakeDm({ folder, home: E2E_HOME })
  try {
    await expect(page.getByText('DM at the table')).toBeVisible()
    await expect.poll(async () => (await second.call('seed')).payload.code).toBe('session_live')
    expect(await first.call('seed')).toMatchObject({ isError: false })

    // Managing the Campaign waits until the session ends.
    await page.goto('/campaigns')
    const row = page.getByRole('row', { name: new RegExp(name) })
    await row.getByRole('button', { name: 'Archive' }).click()
    await expect(page.getByText(/has a live session/)).toBeVisible()
    await expect(row).toBeVisible()

    await second.close()
    await first.close()
  } finally {
    await second.kill()
    await first.kill()
  }
})
