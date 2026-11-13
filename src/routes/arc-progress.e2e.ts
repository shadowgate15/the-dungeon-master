import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { expandArc } from './arc-helpers'
import { seedCharacter } from './character-helpers'
import { createWorld } from './world-helpers'

const FAKE_LM_STUDIO = 'http://127.0.0.1:1235'

// The fake's answer queues are process-wide state: this scenario must not overlap other tests.
test.describe.configure({ mode: 'serial' })

const control = (request: APIRequestContext, path: string, data: unknown) =>
  request.post(`${FAKE_LM_STUDIO}/__control/${path}`, { data })

const arcAnswer = {
  title: 'The Ember Crown',
  premise: 'A relic wakes.',
  stakes: 'The valley burns.',
  acts: [1, 2, 3].map((a) => ({
    name: `Act ${a} name`,
    purpose: 'Things escalate.',
    beats: [1, 2].map((b) => ({ title: `Beat ${a}.${b}`, description: 'Something happens.' }))
  })),
  resolution: 'The relic is destroyed.'
}

/** The extraction calls only (they carry the open Beats), as the model received them. */
async function extractionTexts(request: APIRequestContext) {
  const all = (await (await request.get(`${FAKE_LM_STUDIO}/__control/requests`)).json()) as {
    path: string
    body: { messages: { role: string; content: string }[] }
  }[]
  return all
    .filter((r) => r.path === '/v1/chat/completions')
    .map((r) => r.body.messages.map((m) => m.content).join('\n'))
    .filter((text) => text.includes('MEMORY EXTRACTION'))
}

async function beatId(request: APIRequestContext, title: string, after: number) {
  let id: string | undefined
  await expect(async () => {
    const texts = (await extractionTexts(request)).slice(after)
    id = texts.at(0)?.match(new RegExp(`\\[([0-9a-f-]{36})\\] ${title}:`))?.[1]
    expect(id).toBeDefined()
  }).toPass({ timeout: 15_000 })
  return id!
}

async function createCampaignPage(page: Page, stamp: string) {
  const world = `Prgworld ${stamp}`
  const campaign = `Prg ${stamp}`
  await createWorld(page, world)
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
  await expect(page.getByRole('heading', { name: campaign })).toBeVisible()
  await page.waitForLoadState('networkidle')
  await expandArc(page)
}

test('Beat progress from a scripted extraction shows on the Campaign page, not on the play screen', async ({
  page,
  request
}) => {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`
  const hero = `Hero ${stamp}`
  await seedCharacter(page, hero)
  await createCampaignPage(page, stamp)

  await control(request, 'answers', { answers: [{ content: arcAnswer }], replace: true })
  await page.getByRole('button', { name: 'Generate Arc' }).click()
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('The Ember Crown')
  await page.getByRole('button', { name: 'Accept Arc' }).click()
  await expect(page.getByRole('button', { name: 'Accept Arc' })).toHaveCount(0)
  const campaignUrl = page.url()

  await page.locator('select[name=characterId]').selectOption({ label: hero })
  await page.getByRole('button', { name: 'Link Character' }).click()
  await expect(page.getByText(`Playing as ${hero}.`)).toBeVisible()

  // Session 1 opens; its extraction call lists the open Beats with their ids.
  await control(request, 'answers', { answers: [{ content: 'A gate looms.' }], replace: true })
  await control(request, 'extractions', { answers: [], replace: true })
  const before = (await extractionTexts(request)).length
  await page.getByRole('button', { name: 'Start Session' }).click()
  const transcript = page.getByRole('list', { name: 'Transcript' })
  await expect(transcript).toContainText('A gate looms.')
  const reached = await beatId(request, 'Beat 1.1', before)
  const abandoned = await beatId(request, 'Beat 1.2', before)
  const texts = (await extractionTexts(request)).slice(before)
  expect(texts.at(0)).toContain('Beat 2.2') // the next Act's Beats are offered too
  expect(texts.at(0)).not.toContain('Beat 3.1')

  // The next turn's extraction proposes two transitions.
  await control(request, 'answers', { answers: [{ content: 'The gate falls.' }], replace: true })
  await control(request, 'extractions', {
    answers: [
      {
        content: {
          npcs: [],
          facts: [],
          beats: [
            { id: reached, state: 'reached' },
            { id: abandoned, state: 'abandoned' },
            { id: 'not-a-beat', state: 'reached' }
          ]
        }
      }
    ],
    replace: true
  })
  await page.getByLabel('Your action').fill('I break the gate.')
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(transcript).toContainText('The gate falls.')

  // The play screen stays Arc-free.
  await expect(page.getByText(/Beat 1\.1|Reached in Session/)).toHaveCount(0)

  await page.goto(campaignUrl)
  await expect(async () => {
    await page.reload()
    await expandArc(page)
    await expect(page.getByText('Reached in Session 1')).toBeVisible({ timeout: 1000 })
  }).toPass({ timeout: 15_000 })
  const arcSection = page.getByRole('region', { name: 'Arc' })
  await expect(arcSection.getByText('Abandoned', { exact: true })).toBeVisible()
  await expect(arcSection.getByText('Pending', { exact: true })).toHaveCount(4)
  await expect(arcSection.getByText(/Arc complete/)).toHaveCount(0)
})
