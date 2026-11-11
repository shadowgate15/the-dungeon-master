import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { seedCharacter } from './character-helpers'
import { createWorld } from './world-helpers'

const FAKE_LM_STUDIO = 'http://127.0.0.1:1235'

async function setScenario(request: APIRequestContext, scenario: string) {
  const response = await request.post(`${FAKE_LM_STUDIO}/__control/scenario`, {
    data: { scenario }
  })
  expect(response.ok()).toBe(true)
}

/** Creates a Campaign through the dialog and opens it from the list. */
async function openCampaign(page: Page, name: string, world: string) {
  await page.goto('/campaigns')
  await page.waitForLoadState('networkidle') // the dialog only becomes a modal after hydration
  await page.getByRole('link', { name: 'New Campaign' }).click()
  const dialog = page.getByRole('dialog', { name: 'New Campaign' })
  await dialog.getByLabel('Add World').selectOption({ label: world })
  await dialog.getByLabel('Name', { exact: true }).fill(name)
  await dialog.getByLabel('Premise', { exact: true }).fill('Escort a relic across the ash plains.')
  await dialog.getByLabel('Tone', { exact: true }).selectOption('tense')
  await dialog.getByLabel('Length', { exact: true }).selectOption('short')
  await dialog.getByRole('button', { name: 'Create Campaign' }).click()
  await expect(dialog).toBeHidden()
  await page.getByRole('row').filter({ hasText: name }).getByRole('link', { name: 'Play' }).click()
  await expect(page.getByRole('heading', { name })).toBeVisible()
}

async function linkCharacter(page: Page, name: string) {
  await page.waitForLoadState('networkidle')
  await page.locator('select[name=characterId]').selectOption({ label: name })
  await page.getByRole('button', { name: 'Link Character' }).click()
  await expect(page.getByText(`Playing as ${name}.`)).toBeVisible()
}

test.afterEach(async ({ request }) => {
  await setScenario(request, 'ready')
})

test('links a Character, starts a Session, and ends it read-only', async ({ page }) => {
  const stamp = Date.now()
  const world = `Sessworld ${stamp}`
  const campaign = `Sess ${stamp}`
  const hero = `Brenna ${stamp}`
  await createWorld(page, world)
  await seedCharacter(page, hero)
  await openCampaign(page, campaign, world)

  await expect(page.getByRole('button', { name: 'Start Session' })).toBeDisabled()
  await linkCharacter(page, hero)

  await page.getByRole('button', { name: 'Start Session' }).click()
  await expect(page.getByRole('heading', { name: 'Session 1' })).toBeVisible()
  const sheet = page.getByRole('region', { name: 'Character sheet' })
  await expect(sheet.getByRole('heading', { name: hero })).toBeVisible()
  await expect(sheet.getByRole('group', { name: 'STR' })).toContainText('16') // base 15 plus the human +1, derived

  // A second Session cannot start while this one is open: the hub offers Resume instead.
  await page.goto(page.url().replace(/\/sessions\/.*/, ''))
  await expect(page.getByRole('button', { name: 'Start Session' })).toHaveCount(0)
  await page.getByRole('link', { name: 'Resume Session' }).click()

  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'End Session' }).click()
  await expect(page.getByText('Session ended. This transcript is read-only.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'End Session' })).toHaveCount(0)

  // Once ended, a new Session can start.
  await page.getByRole('link', { name: new RegExp(`^Sess ${stamp}$`) }).click()
  await expect(page.getByRole('button', { name: 'Start Session' })).toBeEnabled()
})

test('the sheet is a drawer on a narrow window', async ({ page }) => {
  const stamp = Date.now()
  const world = `Drawerworld ${stamp}`
  const campaign = `Drawer ${stamp}`
  const hero = `Torvin ${stamp}`
  await createWorld(page, world)
  await seedCharacter(page, hero)
  await openCampaign(page, campaign, world)
  await linkCharacter(page, hero)
  await page.getByRole('button', { name: 'Start Session' }).click()
  await expect(page.getByRole('heading', { name: 'Session 1' })).toBeVisible()

  await page.setViewportSize({ width: 500, height: 800 })
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('heading', { name: hero })).toBeHidden()
  await page.getByRole('button', { name: 'Character sheet' }).click()
  const drawer = page.getByRole('dialog', { name: 'Character sheet drawer' })
  await expect(drawer.getByRole('heading', { name: hero })).toBeVisible()
  await drawer.getByRole('button', { name: 'Close' }).click()
  await expect(drawer).toBeHidden()
})

test('starts a Session while the model is down', async ({ page, request }) => {
  const stamp = Date.now()
  const world = `Downworld ${stamp}`
  const campaign = `Down ${stamp}`
  const hero = `Mira ${stamp}`
  await createWorld(page, world)
  await seedCharacter(page, hero)
  await openCampaign(page, campaign, world)
  await linkCharacter(page, hero)

  await setScenario(request, 'unreachable')
  await page.getByRole('button', { name: 'Start Session' }).click()
  await expect(page.getByRole('heading', { name: 'Session 1' })).toBeVisible()
  await expect(
    page.getByRole('region', { name: 'Character sheet' }).getByRole('heading', { name: hero })
  ).toBeVisible()
})
