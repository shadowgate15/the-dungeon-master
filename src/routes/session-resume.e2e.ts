import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { seedCharacter } from './character-helpers'
import { createWorld } from './world-helpers'

const FAKE_LM_STUDIO = 'http://127.0.0.1:1235'

// The fake's answer queue is process-wide state: these tests must not overlap.
test.describe.configure({ mode: 'serial' })

async function script(request: APIRequestContext, answers: unknown[]) {
  const response = await request.post(`${FAKE_LM_STUDIO}/__control/answers`, {
    data: { answers, replace: true }
  })
  expect(response.ok()).toBe(true)
}

async function modelCalls(request: APIRequestContext) {
  const all = (await (await request.get(`${FAKE_LM_STUDIO}/__control/requests`)).json()) as {
    path: string
  }[]
  return all.filter((r) => r.path === '/v1/chat/completions').length
}

const transcript = (page: Page) => page.getByRole('list', { name: 'Transcript' })

/** Creates a World, Character and Campaign, links them, starts a Session and lets the DM open. */
async function startSession(page: Page, request: APIRequestContext, opening: string) {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`
  const world = `Resworld ${stamp}`
  const campaign = `Res ${stamp}`
  const hero = `Mira ${stamp}`
  await createWorld(page, world)
  await seedCharacter(page, hero)
  await page.goto('/campaigns')
  await page.waitForLoadState('networkidle')
  await page.getByRole('link', { name: 'New Campaign' }).click()
  const dialog = page.getByRole('dialog', { name: 'New Campaign' })
  await dialog.getByLabel('Add World').selectOption({ label: world })
  await dialog.getByLabel('Name', { exact: true }).fill(campaign)
  await dialog.getByLabel('Premise', { exact: true }).fill('Escort a relic across the ash plains.')
  await dialog.getByLabel('Tone', { exact: true }).selectOption('tense')
  await dialog.getByLabel('Length', { exact: true }).selectOption('short')
  await dialog.getByRole('button', { name: 'Create Campaign' }).click()
  await expect(dialog).toBeHidden()
  await page
    .getByRole('row')
    .filter({ hasText: campaign })
    .getByRole('link', { name: 'Play' })
    .click()
  await page.waitForLoadState('networkidle')
  await page.locator('select[name=characterId]').selectOption({ label: hero })
  await page.getByRole('button', { name: 'Link Character' }).click()
  await expect(page.getByText(`Playing as ${hero}.`)).toBeVisible()
  await script(request, [{ content: opening }])
  await page.getByRole('button', { name: 'Start Session' }).click()
  await expect(transcript(page)).toContainText(opening)
  await expect(page.getByLabel('Your action')).toBeVisible()
  return { campaignUrl: page.url().replace(/\/sessions\/.*/, '') }
}

test('closing the browser and resuming restores the transcript, with one stateless recap call', async ({
  page,
  request,
  browser
}) => {
  const { campaignUrl } = await startSession(page, request, 'A gate looms in the ash.')
  await script(request, [{ content: 'The hinges scream.' }])
  await page.getByLabel('Your action').fill('I push the gate.')
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(transcript(page)).toContainText('The hinges scream.')
  await page.close()

  const calls = await modelCalls(request)
  await script(request, [{ content: 'You pushed the gate and it screamed.' }])
  const fresh = await (await browser.newContext()).newPage()
  await fresh.goto(campaignUrl)
  await fresh.getByRole('link', { name: 'Resume Session' }).click()
  const items = transcript(fresh).getByRole('listitem')
  await expect(items).toHaveCount(3)
  await expect(items.nth(0)).toContainText('A gate looms in the ash.')
  await expect(items.nth(1)).toContainText('I push the gate.')
  await expect(items.nth(2)).toContainText('The hinges scream.')
  await expect(fresh.getByLabel('Your action')).toBeVisible()
  await fresh.waitForLoadState('networkidle')
  // The recap is a side call: it shows, is not a Turn, and is the only model call on resume.
  await expect(fresh.getByLabel('Recap')).toContainText('You pushed the gate and it screamed.')
  await expect(items).toHaveCount(3)
  expect(await modelCalls(request)).toBe(calls + 1)

  // Reopening with no new Turns reuses the cached recap: no repeat call.
  await fresh.reload()
  await expect(fresh.getByLabel('Recap')).toContainText('You pushed the gate and it screamed.')
  expect(await modelCalls(request)).toBe(calls + 1)

  // Play carries on from where it was left.
  await script(request, [{ content: 'Beyond lies a dune sea.' }])
  await fresh.getByLabel('Your action').fill('I step through.')
  await fresh.getByRole('button', { name: 'Send' }).click()
  await expect(transcript(fresh)).toContainText('Beyond lies a dune sea.')
})

test('resuming an unanswered action offers Retry and does not call the model', async ({
  page,
  request,
  browser
}) => {
  const { campaignUrl } = await startSession(page, request, 'A gate looms.')
  await script(request, [{ status: 500, times: 3 }])
  await page.getByLabel('Your action').fill('I knock.')
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible()
  await page.close()

  const calls = await modelCalls(request)
  const fresh = await (await browser.newContext()).newPage()
  await fresh.goto(campaignUrl)
  await fresh.getByRole('link', { name: 'Resume Session' }).click()
  await expect(fresh.getByRole('button', { name: 'Retry' })).toBeVisible()
  await expect(transcript(fresh)).toContainText('I knock.')
  await fresh.waitForLoadState('networkidle')
  expect(await modelCalls(request)).toBe(calls)
})

test('an ended Session opens as a read-only transcript', async ({ page, request, browser }) => {
  const { campaignUrl } = await startSession(page, request, 'A gate looms.')
  await page.getByRole('button', { name: 'End Session' }).click()
  await expect(page.getByText('This transcript is read-only.')).toBeVisible()
  await page.close()

  const calls = await modelCalls(request)
  const fresh = await (await browser.newContext()).newPage()
  await fresh.goto(campaignUrl)
  await fresh.getByRole('link', { name: 'Session 1' }).click()
  await expect(transcript(fresh)).toContainText('A gate looms.')
  await expect(fresh.getByText('This transcript is read-only.')).toBeVisible()
  await expect(fresh.getByLabel('Your action')).toHaveCount(0)
  await expect(fresh.getByRole('button', { name: 'Send' })).toHaveCount(0)
  await expect(fresh.getByRole('button', { name: 'Retry' })).toHaveCount(0)
  await expect(fresh.getByRole('button', { name: 'End Session' })).toHaveCount(0)
  expect(await modelCalls(request)).toBe(calls)
})

test('reopening while another window is mid-answer shows no Retry', async ({
  page,
  request,
  browser
}) => {
  const { campaignUrl } = await startSession(page, request, 'A gate looms.')
  await script(request, [{ content: 'Slow reply.', delayMs: 10_000 }])
  await page.getByLabel('Your action').fill('I wait.')
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible()

  const other = await (await browser.newContext()).newPage()
  await other.goto(campaignUrl)
  await other.getByRole('link', { name: 'Resume Session' }).click()
  await expect(other.getByText('answering in another window')).toBeVisible()
  await expect(other.getByRole('button', { name: 'Retry' })).toHaveCount(0)
  await expect(other.getByRole('button', { name: 'End Session' })).toBeDisabled()

  await page.getByRole('button', { name: 'Stop' }).click()
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible()
})

test('submitting an action aborts a recap in flight', async ({ page, request, browser }) => {
  const { campaignUrl } = await startSession(page, request, 'A gate looms.')
  await page.close()

  await script(request, [{ content: 'Slow recap.', delayMs: 10_000 }, { content: 'You step in.' }])
  const fresh = await (await browser.newContext()).newPage()
  await fresh.goto(campaignUrl)
  await fresh.getByRole('link', { name: 'Resume Session' }).click()
  // The recap never blocks: the input is usable while it is in flight.
  await expect(fresh.getByLabel('Your action')).toBeVisible()
  await fresh.getByLabel('Your action').fill('I enter.')
  await fresh.getByRole('button', { name: 'Send' }).click()
  await expect(transcript(fresh)).toContainText('You step in.')
  await expect(fresh.getByLabel('Recap')).toHaveCount(0)
})

test('a failed recap is silent', async ({ page, request, browser }) => {
  const { campaignUrl } = await startSession(page, request, 'A gate looms.')
  await page.close()

  await script(request, [{ status: 500, times: 3 }])
  const fresh = await (await browser.newContext()).newPage()
  await fresh.goto(campaignUrl)
  await fresh.getByRole('link', { name: 'Resume Session' }).click()
  await fresh.waitForLoadState('networkidle')
  await expect(fresh.getByLabel('Your action')).toBeVisible()
  await expect(fresh.getByLabel('Recap')).toHaveCount(0)
  await expect(fresh.getByRole('alert')).toHaveCount(0)
})
