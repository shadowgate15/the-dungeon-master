import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { seedCharacter } from './character-helpers'
import { createWorld } from './world-helpers'

const FAKE_LM_STUDIO = 'http://127.0.0.1:1235'

// The fake's answer queue and scenario are process-wide state: these tests must not overlap.
test.describe.configure({ mode: 'serial' })

async function script(request: APIRequestContext, answers: unknown[]) {
  const response = await request.post(`${FAKE_LM_STUDIO}/__control/answers`, {
    data: { answers, replace: true }
  })
  expect(response.ok()).toBe(true)
}

async function setScenario(request: APIRequestContext, scenario: string) {
  const response = await request.post(`${FAKE_LM_STUDIO}/__control/scenario`, {
    data: { scenario }
  })
  expect(response.ok()).toBe(true)
}

/** Creates a World, a Character and a Campaign, links them and starts a Session. */
async function startSession(page: Page, request: APIRequestContext, opening: string) {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`
  const world = `Errworld ${stamp}`
  const campaign = `Errors ${stamp}`
  const hero = `Brenna ${stamp}`
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
  await expect(page.getByRole('heading', { name: 'Session 1' })).toBeVisible()
  await expect(transcript(page)).toContainText(opening)
  await expect(page.getByLabel('Your action')).toBeVisible()
}

const transcript = (page: Page) => page.getByRole('list', { name: 'Transcript' })
const act = async (page: Page, text: string) => {
  await page.getByLabel('Your action').fill(text)
  await page.getByRole('button', { name: 'Send' }).click()
}

const STEALTH = { check: 'skill', key: 'stealth', dc: 12, reason: 'Slip past the sleeping guard.' }
const askForStealth = {
  content: 'The guard stirs.',
  toolCalls: [{ name: 'request_roll', arguments: STEALTH }]
}
const prompt = (page: Page) => page.getByRole('region', { name: 'Roll request' })
const chip = (page: Page) => page.getByRole('region', { name: 'AI' })
const retry = (page: Page) => page.getByRole('button', { name: 'Retry' })
// The chip popover (hidden) comes first; the inline reason is last.
const reason = (page: Page) => page.getByText(/Not connected\. Start LM Studio/).last()

test.afterEach(async ({ request }) => {
  await setScenario(request, 'ready')
})

test('a failed answer shows an inline error and Retry in place of the input', async ({
  page,
  request
}) => {
  await startSession(page, request, 'A gate looms.')
  await script(request, [{ status: 500, times: 3 }])
  await act(page, 'I knock.')

  await expect(page.getByRole('alert')).toBeVisible()
  await expect(retry(page)).toBeEnabled()
  await expect(page.getByLabel('Your action')).toBeHidden()
  await expect(transcript(page)).toContainText('I knock.')

  await script(request, [{ content: 'The door opens.' }])
  await retry(page).click()
  await expect(transcript(page)).toContainText('The door opens.')
  await expect(page.getByLabel('Your action')).toBeVisible()
})

test('with the model down, Send is disabled with a reason and the chip shows', async ({
  page,
  request
}) => {
  await startSession(page, request, 'A gate looms.')
  await setScenario(request, 'unreachable')
  await page.reload()

  await expect(chip(page).getByText('AI unavailable')).toBeVisible()
  await page.getByLabel('Your action').fill('I wait.')
  await expect(page.getByRole('button', { name: 'Send' })).toBeDisabled()
  await expect(reason(page)).toBeVisible()
  await expect(page.getByRole('button', { name: 'End Session' })).toBeEnabled()

  // Back up: Check connection re-enables Send.
  await setScenario(request, 'ready')
  await chip(page).locator('summary').click()
  await chip(page).getByRole('button', { name: 'Check connection' }).click()
  await expect(page.getByRole('button', { name: 'Send' })).toBeEnabled()
})

test('End works on an unanswered player turn while the model is down', async ({
  page,
  request
}) => {
  await startSession(page, request, 'A gate looms.')
  await script(request, [{ status: 500, times: 3 }])
  await act(page, 'I knock.')
  await expect(retry(page)).toBeVisible()

  await setScenario(request, 'unreachable')
  await page.reload()
  await expect(retry(page)).toBeDisabled()
  await expect(reason(page)).toBeVisible()

  await page.getByRole('button', { name: 'End Session' }).click()
  await expect(page.getByText('Session ended. This transcript is read-only.')).toBeVisible()
  await expect(transcript(page)).toContainText('I knock.')
})

test('the Roll click works with the model down: the roll is saved, then Retry waits for the model', async ({
  page,
  request
}) => {
  await startSession(page, request, 'A gate looms.')
  await script(request, [askForStealth])
  await act(page, 'I sneak.')
  await expect(prompt(page)).toBeVisible()

  await setScenario(request, 'unreachable')
  await page.reload()
  await expect(chip(page).getByText('AI unavailable')).toBeVisible()
  await expect(prompt(page).getByRole('button', { name: 'Roll d20' })).toBeEnabled()
  await prompt(page).getByRole('button', { name: 'Roll d20' }).click()

  const result = transcript(page).getByRole('listitem').filter({ hasText: 'Stealth check:' })
  await expect(result).toHaveCount(1)
  await expect(retry(page)).toBeDisabled()

  await setScenario(request, 'ready')
  await script(request, [{ content: 'You are noticed.' }])
  await chip(page).locator('summary').click()
  await chip(page).getByRole('button', { name: 'Check connection' }).click()
  await expect(retry(page)).toBeEnabled()
  await retry(page).click()
  await expect(transcript(page)).toContainText('You are noticed.')
  await expect(result).toHaveCount(1)
})
