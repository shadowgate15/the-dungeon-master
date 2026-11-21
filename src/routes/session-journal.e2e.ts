import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { seedCharacter } from './character-helpers'
import { FIRST_SCENE, acceptArc, queueFirstScene } from './session-helpers'
import { createWorld } from './world-helpers'

const FAKE_LM_STUDIO = 'http://127.0.0.1:1235'

// The fake's answer queue is process-wide state: this file must not overlap with others.
test.describe.configure({ mode: 'serial' })

/** An Adjudication of happens, in the flat wire shape (the unused fields hold their sentinels). */
const HAPPENS = { outcome: 'happens', skill: 'none', difficulty: 'none', question: '', choices: [] }

/** Scripts the model's answers in order: the Adjudication, the Effect, then the Reply's prose. */
async function script(request: APIRequestContext, answers: unknown[]) {
  const response = await request.post(`${FAKE_LM_STUDIO}/__control/answers`, {
    data: { answers: answers.map((content) => ({ content })), replace: true }
  })
  expect(response.ok()).toBe(true)
}

/** Creates a World, a Character and a Campaign, links them and starts a Session. */
async function startSession(page: Page, request: APIRequestContext) {
  // Returns the Campaign name so the test can come back to it.
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`
  const world = `Tavernworld ${stamp}`
  const campaign = `Tavern ${stamp}`
  const hero = `Brenna ${stamp}`
  await createWorld(page, world)
  await seedCharacter(page, hero)
  await page.goto('/campaigns')
  await page.waitForLoadState('networkidle') // the dialog only becomes a modal after hydration
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
  await acceptArc(page, request)
  await queueFirstScene(request)
  await page.getByRole('button', { name: 'Start Session' }).click()
  await expect(page.getByRole('heading', { name: 'Session 1' })).toBeVisible()
  await page.waitForLoadState('networkidle')
  return campaign
}

test('next Session carries the Scene, shows Previously once, and the Journal', async ({
  page,
  request
}) => {
  const campaign = await startSession(page, request)

  await script(request, [
    HAPPENS,
    { effect: 'none' },
    'Rain hammers the shutters as Orla pours a drink.'
  ])
  await page.getByLabel('Your action').fill('I take a seat by the fire')
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByRole('list', { name: 'Story log' })).toContainText(
    'Rain hammers the shutters as Orla pours a drink.'
  )

  // A first Session has no recap.
  await expect(page.getByRole('heading', { name: 'Previously' })).toHaveCount(0)

  await page.getByRole('button', { name: 'End Session' }).click()
  await expect(page.getByText('Session ended. This log is read-only.')).toBeVisible()

  await page.getByRole('link', { name: campaign }).click()
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Start Session' }).click()
  await expect(page.getByRole('heading', { name: 'Session 2' })).toBeVisible()
  await page.waitForLoadState('networkidle')

  // The Scene carried over.
  const scene = page.getByRole('complementary', { name: 'Scene' })
  await expect(scene.getByRole('region', { name: 'Location' })).toContainText(FIRST_SCENE.place)
  await expect(scene.getByRole('region', { name: 'Present' })).toContainText(FIRST_SCENE.npc)

  // Previously: the last Narrator event, since no summary was written.
  const previously = page.getByRole('region', { name: 'Previously' })
  await expect(previously).toContainText('Rain hammers the shutters as Orla pours a drink.')

  // The Journal lists the NPC with role and stance, grouped by the Session it came from.
  await page.getByRole('button', { name: 'Journal' }).click()
  const journal = page.getByRole('dialog', { name: 'Journal' })
  await expect(journal.getByRole('heading', { name: 'Session 1' })).toBeVisible()
  await expect(journal).toContainText(FIRST_SCENE.npc)
  await expect(journal).toContainText('Innkeeper')
  await expect(journal).toContainText('friendly')
  await journal
    .getByRole('button', { name: 'Close' })
    .or(journal.getByRole('link', { name: 'Close' }))
    .click()

  // The first Declaration hides it.
  await script(request, [HAPPENS, { effect: 'none' }, 'Orla nods and slides a mug over.'])
  await page.getByLabel('Your action').fill('I thank her')
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByRole('list', { name: 'Story log' })).toContainText('slides a mug over')
  await expect(page.getByRole('region', { name: 'Previously' })).toHaveCount(0)
})
