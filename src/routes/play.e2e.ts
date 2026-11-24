import { expect, test, type Page } from '@playwright/test'
import { fighterDraft } from '../lib/server/character/test-characters'
import { startFakeDm, type FakeDm } from '../testing/fake-dm'
import { E2E_HOME } from '../../playwright.config'

/** Creates a Campaign through the New Campaign dialog; returns its id and folder. */
async function createCampaign(page: Page, name: string) {
  await page.goto('/campaigns')
  await page.waitForLoadState('networkidle')
  await page.getByRole('link', { name: 'New Campaign' }).click()
  const dialog = page.getByRole('dialog', { name: 'New Campaign' })
  await dialog.getByLabel('Name', { exact: true }).fill(name)
  const folder = await dialog.getByLabel('Folder').inputValue()
  await dialog.getByRole('button', { name: 'Create Campaign' }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  return { id: page.url().split('/').at(-1)!, folder }
}

/** Saves a finished Fighter into the Party through the Party step's draft API. */
async function addFighter(page: Page, campaign: string, name: string) {
  await page.goto(`/campaigns/${campaign}/party`)
  await page.getByRole('button', { name: 'New Character' }).click()
  await expect(page).toHaveURL(/\/party\?draft=/)
  const draft = new URL(page.url()).searchParams.get('draft')!
  const res = await page.request.post(`/api/campaigns/${campaign}/drafts/${draft}/save`, {
    data: { draft: fighterDraft(name), step: 'review' }
  })
  expect(res.status()).toBe(201)
}

let dm: FakeDm | undefined
test.afterEach(async () => {
  await dm?.kill()
  dm = undefined
})

test('Declarations wait in the pending tray, editable and withdrawable, across a reload', async ({
  page
}) => {
  const { id: campaign, folder } = await createCampaign(page, `Tray Test ${Date.now()}`)
  await addFighter(page, campaign, 'Wren')
  await addFighter(page, campaign, 'Bram')
  dm = await startFakeDm({ folder, home: E2E_HOME })

  await page.goto(`/campaigns/${campaign}/play`)
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('tabpanel', { name: 'Wren' })).toBeVisible()

  await page.getByRole('textbox', { name: 'What does Wren do?' }).fill('I pick the lock.')
  await page.getByRole('button', { name: 'Send' }).click()
  await page.getByRole('tab', { name: 'Bram' }).click()
  await page.getByRole('textbox', { name: 'What does Bram do?' }).fill('I watch the street.')
  await page.getByRole('button', { name: 'Send' }).click()

  const tray = page.getByRole('list', { name: 'Pending Declarations' })
  await expect(tray.getByRole('listitem')).toHaveText([
    /Wren\s*I pick the lock\./,
    /Bram\s*I watch the street\./
  ])

  await page.getByRole('button', { name: 'Edit Wren: I pick the lock.' }).click()
  await page.getByRole('textbox', { name: 'Edit Declaration' }).fill('I pick the lock quietly.')
  await page.getByRole('button', { name: 'Save' }).click()
  await page.getByRole('button', { name: 'Withdraw Bram: I watch the street.' }).click()
  await expect(tray.getByRole('listitem')).toHaveText([/Wren\s*I pick the lock quietly\./])

  await page.reload()
  await expect(tray.getByRole('listitem')).toHaveText([/Wren\s*I pick the lock quietly\./])
})

test('the console is bound to the viewport and the composer stays pinned', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  const { id: campaign, folder } = await createCampaign(page, `Viewport Test ${Date.now()}`)
  await addFighter(page, campaign, 'Wren')
  dm = await startFakeDm({ folder, home: E2E_HOME })

  await page.goto(`/campaigns/${campaign}/play`)
  await page.waitForLoadState('networkidle')
  const box = page.getByRole('textbox', { name: 'What does Wren do?' })
  for (let i = 0; i < 12; i++) {
    await box.fill(`Step ${i}: I keep walking down the long corridor, looking for traps.`)
    await page.getByRole('button', { name: 'Send' }).click()
  }
  await expect(
    page.getByRole('list', { name: 'Pending Declarations' }).getByRole('listitem')
  ).toHaveCount(12)

  const scroll = await page.evaluate(() => ({
    page: document.scrollingElement!.scrollHeight,
    viewport: window.innerHeight
  }))
  expect(scroll.page).toBeLessThanOrEqual(scroll.viewport)
  const composer = await box.boundingBox()
  expect(composer!.y + composer!.height).toBeLessThanOrEqual(720)
})
