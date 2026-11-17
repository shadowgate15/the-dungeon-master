import { expect, test, type Page } from '@playwright/test'
import { seedCharacter } from './character-helpers'
import { createWorld } from './world-helpers'

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

test('starts a Session, shows its Scene, saves an action and restores both on reload', async ({
  page
}) => {
  const stamp = Date.now()
  const world = `Sceneworld ${stamp}`
  const campaign = `Scene ${stamp}`
  const hero = `Brenna ${stamp}`
  await createWorld(page, world)
  await seedCharacter(page, hero)
  await openCampaign(page, campaign, world)

  await expect(page.getByRole('button', { name: 'Start Session' })).toBeDisabled()
  await page.waitForLoadState('networkidle')
  await page.locator('select[name=characterId]').selectOption({ label: hero })
  await page.getByRole('button', { name: 'Link Character' }).click()
  await expect(page.getByText(`Playing as ${hero}.`)).toBeVisible()

  await page.getByRole('button', { name: 'Start Session' }).click()
  await expect(page.getByRole('heading', { name: 'Session 1' })).toBeVisible()

  // The seeded Scene is on screen, the log is empty.
  const scene = page.getByRole('complementary', { name: 'Scene' })
  await expect(scene.getByRole('region', { name: 'Location' })).toContainText(
    'The Sleeping Griffin'
  )
  await expect(scene.getByRole('region', { name: 'Exits' }).getByRole('listitem')).not.toHaveCount(
    0
  )
  await expect(
    scene.getByRole('region', { name: 'Objects' }).getByRole('listitem')
  ).not.toHaveCount(0)
  await expect(scene.getByRole('region', { name: 'Present' })).toContainText('Marta')
  await expect(scene.getByRole('region', { name: 'Mode' })).toContainText('exploration')
  await expect(scene.getByRole('region', { name: 'Pending roll' })).toContainText('None')
  await expect(page.getByText('Nothing has happened yet.')).toBeVisible()

  // An action lands in the story log.
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Your action').fill('I warm my hands by the hearth')
  await page.getByRole('button', { name: 'Send' }).click()
  const log = page.getByRole('list', { name: 'Story log' })
  await expect(log).toContainText('I warm my hands by the hearth')

  // Reload restores the Scene and the log.
  await page.reload()
  await expect(page.getByRole('list', { name: 'Story log' })).toContainText(
    'I warm my hands by the hearth'
  )
  await expect(
    page.getByRole('complementary', { name: 'Scene' }).getByRole('region', { name: 'Location' })
  ).toContainText('The Sleeping Griffin')

  // A second Session cannot start while this one is open: the Campaign page offers Resume.
  await page.getByRole('link', { name: campaign }).click()
  await expect(page.getByRole('button', { name: 'Start Session' })).toHaveCount(0)
  await page.getByRole('link', { name: 'Resume Session' }).click()

  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'End Session' }).click()
  await expect(page.getByText('Session ended. This log is read-only.')).toBeVisible()
})
