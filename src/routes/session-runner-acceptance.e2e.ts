import { expect, test, type APIRequestContext } from '@playwright/test'
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

type Logged = { path: string; body: { messages: { role: string; content: string }[] } }
const chatRequests = async (request: APIRequestContext) =>
  ((await (await request.get(`${FAKE_LM_STUDIO}/__control/requests`)).json()) as Logged[]).filter(
    (r) => r.path === '/v1/chat/completions'
  )
const isExtraction = (r: Logged) => JSON.stringify(r.body.messages).includes('MEMORY EXTRACTION')
const text = (r: Logged) => r.body.messages.map((m) => m.content).join('\n')

/** Waits for the first extraction request after `after` requests and returns its text. */
async function firstExtractionAfter(request: APIRequestContext, after: number) {
  let found: string | undefined
  await expect(async () => {
    const extraction = (await chatRequests(request)).slice(after).find(isExtraction)
    found = extraction ? text(extraction) : undefined
    expect(found).toBeDefined()
  }).toPass({ timeout: 15_000 })
  return found!
}

test('acceptance: an NPC and a world change from one Session shape the next, along the Arc', async ({
  page,
  request
}) => {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`
  const world = `Accworld ${stamp}`
  const campaign = `Acc ${stamp}`
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
  await expect(page.getByRole('heading', { name: campaign })).toBeVisible()
  await page.waitForLoadState('networkidle')
  const campaignUrl = page.url()
  await expandArc(page)

  // Generate and accept the Arc.
  await control(request, 'answers', { answers: [{ content: arcAnswer }], replace: true })
  await page.getByRole('button', { name: 'Generate Arc' }).click()
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('The Ember Crown')
  await page.getByRole('button', { name: 'Accept Arc' }).click()
  await expect(page.getByRole('button', { name: 'Accept Arc' })).toHaveCount(0)
  await page.locator('select[name=characterId]').selectOption({ label: hero })
  await page.getByRole('button', { name: 'Link Character' }).click()
  await expect(page.getByText(`Playing as ${hero}.`)).toBeVisible()

  // Session 1: the opening, then a Turn where Grom appears and the Character burns the bridge.
  const transcript = page.getByRole('list', { name: 'Transcript' })
  await control(request, 'answers', { answers: [{ content: 'A gate looms.' }], replace: true })
  await control(request, 'extractions', { answers: [], replace: true })
  const before = (await chatRequests(request)).length
  await page.getByRole('button', { name: 'Start Session' }).click()
  await expect(transcript).toContainText('A gate looms.')
  const openExtraction = await firstExtractionAfter(request, before)
  const beatId = openExtraction.match(/\[([0-9a-f-]{36})\] Beat 1\.1:/)?.[1]
  expect(beatId).toBeDefined()

  await control(request, 'answers', {
    answers: [{ content: 'Grom, a scarred warden, watches the bridge burn.' }],
    replace: true
  })
  await control(request, 'extractions', {
    answers: [
      {
        content: {
          npcs: [
            {
              name: 'Grom',
              description: 'A scarred gate warden.',
              role: 'warden',
              status: 'alive',
              stance: 'wary'
            }
          ],
          facts: [
            {
              title: 'The Ashen Bridge is burned',
              detail: 'Tessa set the bridge alight.',
              worldChanging: true
            }
          ],
          beats: [{ id: beatId, state: 'reached' }]
        }
      }
    ],
    replace: true
  })
  await page.getByLabel('Your action').fill('I burn the Ashen Bridge.')
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(transcript).toContainText('watches the bridge burn')

  // End the Session; starting a new one drains extraction, so the memory is in before the opening.
  await page.getByRole('button', { name: 'End Session' }).click()
  await expect(page.getByText('This transcript is read-only.')).toBeVisible()
  await page.goto(campaignUrl)
  await page.waitForLoadState('networkidle')
  await control(request, 'answers', {
    answers: [{ content: 'Grom eyes the ruined bridge.' }],
    replace: true
  })
  await control(request, 'extractions', { answers: [], replace: true })
  const beforeSession2 = (await chatRequests(request)).length
  await page.getByRole('button', { name: 'Start Session' }).click()
  await expect(page.getByRole('heading', { name: 'Session 2' })).toBeVisible()
  await expect(transcript).toContainText('Grom eyes the ruined bridge.')

  // The model saw the NPC, the world change and the Arc's current Act.
  const dm = (await chatRequests(request)).slice(beforeSession2).filter((r) => !isExtraction(r))
  expect(dm).toHaveLength(1)
  const system = dm[0].body.messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n')
  expect(system).toContain('Grom')
  expect(system).toContain('A scarred gate warden.')
  expect(system).toContain('The Ashen Bridge is burned')
  expect(system).toContain('Act 1 name')
  expect(system).toContain('Beat 1.2') // Beat 1.1 is reached; play is nudged to what remains
  expect(system).not.toContain('Act 2 name')

  // The Journal shows both.
  await page.getByRole('button', { name: /^Journal/ }).click()
  const overlay = page.getByRole('dialog', { name: 'Journal' })
  const session1 = overlay.getByRole('region', { name: 'Session 1' })
  await expect(session1).toContainText('Grom')
  await expect(session1).toContainText('The Ashen Bridge is burned')
  await overlay.getByRole('button', { name: 'Close' }).click()

  // The Campaign page reflects the Beat.
  await page.goto(campaignUrl)
  await expandArc(page)
  await expect(page.getByText('Reached in Session 1')).toBeVisible()
})
