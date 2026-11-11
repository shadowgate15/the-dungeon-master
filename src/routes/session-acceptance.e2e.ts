import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { seedCharacter } from './character-helpers'
import { createWorld } from './world-helpers'

const FAKE_LM_STUDIO = 'http://127.0.0.1:1235'

// The fake's answer queue is process-wide state: this scenario must not overlap other tests.
test.describe.configure({ mode: 'serial' })

async function script(request: APIRequestContext, answers: unknown[]) {
  const response = await request.post(`${FAKE_LM_STUDIO}/__control/answers`, {
    data: { answers, replace: true }
  })
  expect(response.ok()).toBe(true)
}

const transcript = (page: Page) => page.getByRole('list', { name: 'Transcript' })
const prompt = (page: Page) => page.getByRole('region', { name: 'Roll request' })

async function act(page: Page, text: string) {
  await page.getByLabel('Your action').fill(text)
  await page.getByRole('button', { name: 'Send' }).click()
}

test('open a Campaign, play Turns with a dice check, close the browser and resume', async ({
  page,
  request,
  browser
}) => {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`
  const world = `Accworld ${stamp}`
  const campaign = `Acc ${stamp}`
  const hero = `Tessa ${stamp}`

  // Set up: a World, a Character and a Campaign linking them.
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

  // Open the Campaign and start a Session with the Character.
  await page
    .getByRole('row')
    .filter({ hasText: campaign })
    .getByRole('link', { name: 'Play' })
    .click()
  await page.waitForLoadState('networkidle')
  await page.locator('select[name=characterId]').selectOption({ label: hero })
  await page.getByRole('button', { name: 'Link Character' }).click()
  await expect(page.getByText(`Playing as ${hero}.`)).toBeVisible()
  await script(request, [{ content: 'A gate looms in the ash.' }])
  await page.getByRole('button', { name: 'Start Session' }).click()
  await expect(page.getByRole('heading', { name: 'Session 1' })).toBeVisible()
  await expect(transcript(page)).toContainText('A gate looms in the ash.')

  const campaignUrl = page.url().replace(/\/sessions\/.*/, '')

  // Turn 1: plain narration.
  await script(request, [{ content: 'The hinges scream.' }])
  await act(page, 'I push the gate.')
  await expect(transcript(page)).toContainText('The hinges scream.')

  // Turn 2: a dice check. The prompt replaces the input; code rolls the d20.
  await script(request, [
    {
      content: 'A guard stirs behind the gate.',
      toolCalls: [
        {
          name: 'request_roll',
          arguments: { check: 'skill', key: 'stealth', dc: 12, reason: 'Slip past the guard.' }
        }
      ]
    }
  ])
  await act(page, 'I sneak past the guard.')
  await expect(prompt(page)).toContainText('Stealth check, DC 12')
  await expect(page.getByLabel('Your action')).toBeHidden()
  await script(request, [{ content: 'You slip through unseen.' }])
  await prompt(page).getByRole('button', { name: 'Roll d20' }).click()
  await expect(transcript(page)).toContainText('You slip through unseen.')
  await expect(page.getByLabel('Your action')).toBeVisible()

  // Dice are process-wide seeded, so assert the arithmetic rather than a die value.
  const result = transcript(page).getByRole('listitem').filter({ hasText: 'Stealth check:' })
  await expect(result).toHaveCount(1)
  const text = (await result.textContent()) ?? ''
  const [, d20, sign, modifier, total] = text.match(/(\d+) ([+-]) (\d+) = (-?\d+) against DC 12/)!
  expect(Number(d20)).toBeGreaterThanOrEqual(1)
  expect(Number(d20)).toBeLessThanOrEqual(20)
  expect(Number(total)).toBe(Number(d20) + (sign === '-' ? -1 : 1) * Number(modifier))

  // Turn 3: carry on after the check.
  await script(request, [{ content: 'Beyond lies a dune sea.' }])
  await act(page, 'I step through.')
  await expect(transcript(page)).toContainText('Beyond lies a dune sea.')

  const expected = [
    'A gate looms in the ash.',
    'I push the gate.',
    'The hinges scream.',
    'I sneak past the guard.',
    'A guard stirs behind the gate.',
    'Stealth check:',
    'You slip through unseen.',
    'I step through.',
    'Beyond lies a dune sea.'
  ]
  const items = transcript(page).getByRole('listitem')
  await expect(items).toHaveCount(expected.length)

  // Close the browser; resume in a new context on the same database. The recap is the
  // first (and only) model call on resume, so script it before opening the page.
  await page.context().close()
  await script(request, [{ content: 'You slipped past the guard and stepped through.' }])
  const fresh = await (await browser.newContext()).newPage()
  await fresh.goto(campaignUrl)
  await fresh.getByRole('link', { name: 'Resume Session' }).click()

  const resumed = transcript(fresh).getByRole('listitem')
  await expect(resumed).toHaveCount(expected.length)
  for (const [i, part] of expected.entries()) await expect(resumed.nth(i)).toContainText(part)
  // The made roll is restored exactly, never re-rolled.
  await expect(resumed.nth(5)).toContainText(`${d20} ${sign} ${modifier} = ${total}`)
  await expect(fresh.getByLabel('Recap')).toContainText('You slipped past the guard')
  await expect(resumed).toHaveCount(expected.length)

  // Play carries on from where it was left.
  await script(request, [{ content: 'The dunes shimmer.' }])
  await act(fresh, 'I walk on.')
  await expect(transcript(fresh)).toContainText('The dunes shimmer.')
  await expect(resumed).toHaveCount(expected.length + 2)
})
