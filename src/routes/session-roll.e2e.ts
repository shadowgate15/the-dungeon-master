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

/** The messages the model received for the latest DM call. */
async function lastModelRequest(request: APIRequestContext) {
  const all = (await (await request.get(`${FAKE_LM_STUDIO}/__control/requests`)).json()) as {
    path: string
    body: { messages: { role: string; content: string }[] }
  }[]
  // The silent memory extraction call after each DM turn is not a DM call.
  return all
    .filter((r) => r.path === '/v1/chat/completions')
    .filter((r) => !JSON.stringify(r.body.messages).includes('MEMORY EXTRACTION'))
    .at(-1)!.body.messages
}

/** Creates a World, a Character and a Campaign, links them and starts a Session. */
async function startSession(page: Page, request: APIRequestContext, opening: string) {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`
  const world = `Rollworld ${stamp}`
  const campaign = `Rolls ${stamp}`
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

test('a Roll request replaces the input; the click rolls and the DM narrates the outcome', async ({
  page,
  request
}) => {
  await startSession(page, request, 'A gate looms in the ash.')

  await script(request, [askForStealth])
  await act(page, 'I sneak past the guard.')

  await expect(prompt(page)).toContainText('Stealth check, DC 12')
  await expect(prompt(page)).toContainText('Slip past the sleeping guard.')
  await expect(page.getByLabel('Your action')).toBeHidden()
  await expect(transcript(page)).toContainText('The guard stirs.')

  await script(request, [{ content: 'You slip by unseen.' }])
  await prompt(page).getByRole('button', { name: 'Roll d20' }).click()

  await expect(transcript(page)).toContainText('You slip by unseen.')
  await expect(page.getByLabel('Your action')).toBeVisible()
  const result = transcript(page).getByRole('listitem').filter({ hasText: 'Stealth check:' })
  await expect(result).toContainText(/Stealth check: \d+ [+-] \d+ = -?\d+ against DC 12/)

  // The roll sits where the DM asked, and the model was told the total code produced.
  const text = (await result.textContent()) ?? ''
  const [, d20, sign, modifier, total] = text.match(/(\d+) ([+-]) (\d+) = (-?\d+)/)!
  expect(Number(total)).toBe(Number(d20) + (sign === '-' ? -1 : 1) * Number(modifier))
  const sent = await lastModelRequest(request)
  expect(sent.at(-1)).toEqual({
    role: 'user',
    content: `I rolled ${d20} ${sign} ${modifier} = ${total}.`
  })
  const items = transcript(page).getByRole('listitem')
  await expect(items.nth(2)).toContainText('The guard stirs.')
  await expect(items.nth(3)).toContainText('Stealth check:')
  await expect(items.nth(4)).toContainText('You slip by unseen.')
})

test('a pending roll survives a closed browser and is still answerable', async ({
  page,
  request,
  browser
}) => {
  await startSession(page, request, 'A gate looms.')
  await script(request, [askForStealth])
  await act(page, 'I sneak.')
  await expect(prompt(page)).toBeVisible()
  const url = page.url()
  await page.close()

  const fresh = await (await browser.newContext()).newPage()
  await fresh.goto(url)
  await expect(prompt(fresh)).toContainText('Stealth check, DC 12')
  await expect(fresh.getByLabel('Your action')).toBeHidden()

  await script(request, [{ content: 'The guard sleeps on.' }])
  await prompt(fresh).getByRole('button', { name: 'Roll d20' }).click()
  await expect(transcript(fresh)).toContainText('The guard sleeps on.')
})

test('invalid requests are rejected to the model; the third ends as a failure, then Retry works', async ({
  page,
  request
}) => {
  await startSession(page, request, 'A gate looms.')
  const invalid = { toolCalls: [{ name: 'request_roll', arguments: { ...STEALTH, dc: 99 } }] }

  // Two rejections are tolerated: the model corrects itself on its third call.
  await script(request, [invalid, invalid, askForStealth])
  await act(page, 'I sneak.')
  await expect(prompt(page)).toBeVisible()
  await page.reload()
  await expect(prompt(page)).toContainText('DC 12')
  await script(request, [{ content: 'Seen!' }])
  await prompt(page).getByRole('button', { name: 'Roll d20' }).click()
  await expect(transcript(page)).toContainText('Seen!')

  // Three rejections end the turn as a generic failure with the action kept.
  await script(request, [invalid, invalid, invalid])
  await act(page, 'I try again.')
  await expect(page.getByRole('alert')).toContainText('could not make a valid roll request')
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible()
  await expect(transcript(page)).toContainText('I try again.')
  await expect(prompt(page)).toBeHidden()

  await script(request, [{ content: 'Nothing happens.' }])
  await page.getByRole('button', { name: 'Retry' }).click()
  await expect(transcript(page)).toContainText('Nothing happens.')
})

test('a roll is made even when the model is down, and Retry never re-rolls it', async ({
  page,
  request
}) => {
  await startSession(page, request, 'A gate looms.')
  await script(request, [askForStealth])
  await act(page, 'I sneak.')
  await expect(prompt(page)).toBeVisible()

  await script(request, [{ status: 500, times: 3 }])
  await prompt(page).getByRole('button', { name: 'Roll d20' }).click()
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible()
  const result = transcript(page).getByRole('listitem').filter({ hasText: 'Stealth check:' })
  await expect(result).toHaveCount(1)
  const made = await result.textContent()

  await script(request, [{ content: 'You are noticed.' }])
  await page.getByRole('button', { name: 'Retry' }).click()
  await expect(transcript(page)).toContainText('You are noticed.')
  await expect(result).toHaveCount(1)
  expect(await result.textContent()).toBe(made)
})
