import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { seedCharacter } from './character-helpers'
import { createWorld } from './world-helpers'

const FAKE_LM_STUDIO = 'http://127.0.0.1:1235'

// The fake's answer queue is process-wide state: this file must not overlap with others.
test.describe.configure({ mode: 'serial' })

/** Scripts the model's answers in order: Director picks (menu ids) and Narrator/NPC prose. */
async function script(request: APIRequestContext, answers: string[]) {
  const response = await request.post(`${FAKE_LM_STUDIO}/__control/answers`, {
    data: { answers: answers.map((content) => ({ content })), replace: true }
  })
  expect(response.ok()).toBe(true)
}

/** Creates a World, a Character and a Campaign, links them and starts a Session. */
async function startSession(page: Page) {
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
  await page.getByRole('button', { name: 'Start Session' }).click()
  await expect(page.getByRole('heading', { name: 'Session 1' })).toBeVisible()
  await page.waitForLoadState('networkidle')
}

test('plays a scene: narration, an NPC line, dialogue, a roll and the story continues', async ({
  page,
  request
}) => {
  await startSession(page)
  const log = page.getByRole('list', { name: 'Story log' })
  const scene = page.getByRole('complementary', { name: 'Scene' })
  const act = async (text: string) => {
    await page.getByLabel('Your action').fill(text)
    await page.getByRole('button', { name: 'Send' }).click()
  }

  // Action 1: the Director narrates, lets Marta speak, opens dialogue, then yields.
  await script(request, [
    'narrate',
    'The hearth crackles as the room turns to look at you.',
    'npc-speaks:marta',
    'Welcome in, traveller. Sit and warm yourself.',
    'begin-dialogue:marta',
    'yield'
  ])
  await act('I push open the door and step inside')
  await expect(log).toContainText('I push open the door and step inside')
  await expect(log).toContainText('The hearth crackles as the room turns to look at you.')
  await expect(log.getByRole('blockquote')).toContainText('Marta')
  await expect(log).toContainText('Welcome in, traveller. Sit and warm yourself.')
  await expect(log).toContainText('Dialogue with Marta')
  await expect(scene.getByRole('region', { name: 'Mode' })).toContainText('dialogue')

  // Action 2: the Director asks for a roll, and the player must answer it.
  await script(request, [
    'roll:persuasion',
    'narrate',
    'Marta weighs your words, then nods slowly.',
    'yield'
  ])
  await act('I ask Marta for a discount on a room')
  const prompt = page.getByRole('alertdialog')
  await expect(prompt).toContainText('persuasion check')
  await expect(prompt).toContainText('DC 13')
  await expect(scene.getByRole('region', { name: 'Pending roll' })).not.toContainText('None')

  // The prompt comes back after a reload: there is no way to skip it.
  await page.reload()
  await expect(page.getByRole('alertdialog')).toContainText('persuasion check')

  // Rolling resolves it, and the story continues.
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Roll d20' }).click()
  await expect(page.getByRole('alertdialog')).toBeHidden()
  await expect(log).toContainText('Marta weighs your words, then nods slowly.')
  await expect(scene.getByRole('region', { name: 'Pending roll' })).toContainText('None')
  await expect(page.getByLabel('Your action')).toBeEnabled()
})
