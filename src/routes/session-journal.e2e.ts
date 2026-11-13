import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { seedCharacter } from './character-helpers'
import { createWorld } from './world-helpers'

const FAKE_LM_STUDIO = 'http://127.0.0.1:1235'

// The fake's answer queues are process-wide state: this scenario must not overlap other tests.
test.describe.configure({ mode: 'serial' })

async function post(request: APIRequestContext, path: string, answers: unknown[]) {
  const response = await request.post(`${FAKE_LM_STUDIO}${path}`, {
    data: { answers, replace: true }
  })
  expect(response.ok()).toBe(true)
}
const script = (request: APIRequestContext, answers: unknown[]) =>
  post(request, '/__control/answers', answers)
const scriptExtractions = (request: APIRequestContext, answers: unknown[]) =>
  post(request, '/__control/extractions', answers)

const transcript = (page: Page) => page.getByRole('list', { name: 'Transcript' })
const journalButton = (page: Page) => page.getByRole('button', { name: /^Journal/ })
const overlay = (page: Page) => page.getByRole('dialog', { name: 'Journal' })

/** The Journal button's count appears once extraction has landed and the page has reloaded. */
async function untilJournalShows(page: Page, label: RegExp) {
  await expect(async () => {
    await page.reload()
    await expect(journalButton(page)).toHaveText(label, { timeout: 1000 })
  }).toPass({ timeout: 15_000 })
}

test('the Journal shows what was extracted, with chips that clear on close', async ({
  page,
  request
}) => {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`
  const world = `Jrnworld ${stamp}`
  const campaign = `Jrn ${stamp}`
  const hero = `Tessa ${stamp}`
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
  const campaignUrl = page.url()

  // Session 1: the DM opens and introduces Grom; extraction records him and a world change.
  await script(request, [{ content: 'Grom, a scarred warden, bars the gate.' }])
  await scriptExtractions(request, [
    {
      content: {
        npcs: [
          {
            name: 'Grom',
            description: 'A scarred gate warden.',
            role: 'warden',
            status: 'alive',
            stance: 'wary',
            note: 'Distrusts strangers.',
            knows: ['The gate is sealed']
          }
        ],
        facts: [{ title: 'The gate is sealed', detail: 'Nobody crosses at night.' }]
      }
    }
  ])
  await page.getByRole('button', { name: 'Start Session' }).click()
  await expect(transcript(page)).toContainText('Grom, a scarred warden')
  await untilJournalShows(page, /Journal\s*·\s*2 new/)

  // Open: the entries, grouped by Session, with chips.
  await journalButton(page).click()
  await expect(overlay(page)).toBeVisible()
  const session1 = overlay(page).getByRole('region', { name: 'Session 1' })
  await expect(session1).toContainText('Grom')
  await expect(session1).toContainText('A scarred gate warden.')
  await expect(session1).toContainText('Person · warden · alive · wary')
  await expect(session1).toContainText('Knows: The gate is sealed')
  await expect(session1).toContainText('The gate is sealed')
  await expect(session1.getByText('New', { exact: true })).toHaveCount(2)
  await overlay(page).getByRole('button', { name: 'Facts (1)' }).click()
  await expect(overlay(page)).not.toContainText('Grom, a scarred')
  await expect(overlay(page).getByText('Nobody crosses at night.')).toBeVisible()

  // Close: the chips and the count clear, and stay cleared after a reload.
  await overlay(page).getByRole('button', { name: 'Close' }).click()
  await expect(overlay(page)).toBeHidden()
  await expect(journalButton(page)).toHaveText(/^Journal$/)
  await page.reload()
  await expect(journalButton(page)).toHaveText(/^Journal$/)
  await journalButton(page).click()
  await expect(overlay(page).getByText('New', { exact: true })).toHaveCount(0)
  await overlay(page).getByRole('button', { name: 'Close' }).click()

  // Session 2 resumes the Journal: Session 1 stays under its heading and only what the new
  // Session added or changed carries a chip.
  await script(request, [{ content: 'Grom lies dead at the gate.' }])
  await scriptExtractions(request, [
    {
      content: {
        npcs: [{ name: 'Mira', description: 'A ferrywoman.', role: 'ferry', status: 'alive' }],
        facts: []
      }
    }
  ])
  await page.getByRole('button', { name: 'End Session' }).click()
  await expect(page.getByText('This transcript is read-only.')).toBeVisible()
  await page.goto(campaignUrl)
  await page.getByRole('button', { name: 'Start Session' }).click()
  await expect(page.getByRole('heading', { name: 'Session 2' })).toBeVisible()
  await expect(transcript(page)).toContainText('Grom lies dead at the gate.')
  await untilJournalShows(page, /Journal\s*·\s*1 new/)
  await journalButton(page).click()
  await expect(overlay(page).getByRole('region', { name: 'Session 1' })).toContainText('Grom')
  await expect(
    overlay(page).getByRole('region', { name: 'Session 1' }).getByText('New', { exact: true })
  ).toHaveCount(0)
  await expect(overlay(page).getByRole('region', { name: 'Session 2' })).toContainText('Mira')
  await expect(
    overlay(page).getByRole('region', { name: 'Session 2' }).getByText('New', { exact: true })
  ).toHaveCount(1)
})

test('with nothing recorded the Journal still opens, on a blank page', async ({
  page,
  request
}) => {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`
  const world = `Blankworld ${stamp}`
  const campaign = `Blank ${stamp}`
  const hero = `Dax ${stamp}`
  await createWorld(page, world)
  await seedCharacter(page, hero)
  await page.goto('/campaigns')
  await page.waitForLoadState('networkidle')
  await page.getByRole('link', { name: 'New Campaign' }).click()
  const dialog = page.getByRole('dialog', { name: 'New Campaign' })
  await dialog.getByLabel('Add World').selectOption({ label: world })
  await dialog.getByLabel('Name', { exact: true }).fill(campaign)
  await dialog.getByLabel('Premise', { exact: true }).fill('A quiet road.')
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
  await script(request, [{ content: 'The road is quiet.' }])
  await scriptExtractions(request, [{ content: { npcs: [], facts: [] } }])
  await page.getByRole('button', { name: 'Start Session' }).click()
  await expect(transcript(page)).toContainText('The road is quiet.')

  await expect(journalButton(page)).toHaveText(/^Journal$/)
  await journalButton(page).click()
  await expect(overlay(page).getByText('A blank page.')).toBeVisible()
  await overlay(page).getByRole('button', { name: 'Close' }).click()
  await expect(overlay(page)).toBeHidden()
})
