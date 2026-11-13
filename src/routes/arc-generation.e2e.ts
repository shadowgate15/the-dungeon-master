import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { seedCharacter } from './character-helpers'
import { createWorld } from './world-helpers'

const FAKE_LM_STUDIO = 'http://127.0.0.1:1235'

const control = (request: APIRequestContext, path: string, data: unknown) =>
  request.post(`${FAKE_LM_STUDIO}/__control/${path}`, { data })

const arcAnswer = (acts: number, beats: number, title = 'The Ember Crown') => ({
  title,
  premise: 'A relic wakes.',
  stakes: 'The valley burns.',
  acts: Array.from({ length: acts }, (_, a) => ({
    name: `Act ${a + 1} name`,
    purpose: 'Things escalate.',
    beats: Array.from({ length: beats }, (_, b) => ({
      title: `Beat ${a + 1}.${b + 1}`,
      description: 'Something happens.'
    }))
  })),
  resolution: 'The relic is destroyed.'
})

const queue = (request: APIRequestContext, ...answers: object[]) =>
  control(request, 'answers', { answers })

// The fake's answer queue is process-wide state.
test.describe.configure({ mode: 'serial' })
test.afterEach(async ({ request }) => {
  await control(request, 'scenario', { scenario: 'ready' })
  await control(request, 'answers', { answers: [], replace: true })
})

/** Creates a short Campaign and opens its page. */
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
  await page.waitForLoadState('networkidle')
}

async function setup(page: Page, label: string) {
  const stamp = Date.now()
  const world = `Planworld ${label} ${stamp}`
  const campaign = `Plan ${label} ${stamp}`
  await createWorld(page, world)
  await openCampaign(page, campaign, world)
  return { world, campaign, stamp }
}

test('generates a draft Arc, edits it, accepts it, and Start Session was never gated on it', async ({
  page,
  request
}) => {
  await setup(page, 'flow')
  await expect(page.getByText(/No Arc yet/)).toBeVisible()
  await queue(request, { content: arcAnswer(3, 2) })

  await page.getByRole('button', { name: 'Generate Arc' }).click()
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('The Ember Crown')
  await expect(page.getByRole('button', { name: 'Accept Arc' })).toBeVisible()

  await page.getByLabel('Title', { exact: true }).fill('A Better Title')
  await page.getByRole('button', { name: 'Accept Arc' }).click()
  await expect(page.getByRole('button', { name: 'Accept Arc' })).toHaveCount(0)

  await page.reload()
  await page.waitForLoadState('networkidle')
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('A Better Title')
})

test('regenerate is free on a draft; on an accepted Arc it asks first', async ({
  page,
  request
}) => {
  await setup(page, 'regen')
  await queue(request, { content: arcAnswer(3, 2, 'First') })
  await page.getByRole('button', { name: 'Generate Arc' }).click()
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('First')

  await queue(request, { content: arcAnswer(3, 2, 'Second') })
  await page.getByRole('button', { name: 'Regenerate' }).click()
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Second')

  await page.getByRole('button', { name: 'Accept Arc' }).click()
  await expect(page.getByRole('button', { name: 'Accept Arc' })).toHaveCount(0)

  await queue(request, { content: arcAnswer(3, 2, 'Third') })
  await page.getByRole('button', { name: 'Regenerate' }).click()
  await expect(page.getByText(/replaces the whole Arc, including your edits/)).toBeVisible()
  await page.getByRole('button', { name: 'Replace Arc' }).click()
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Third')
})

test('an invalid answer is retried once; a failure leaves the Arc unchanged', async ({
  page,
  request
}) => {
  await setup(page, 'fail')
  // Wrong size first (2 Acts for a short Campaign), then a valid one.
  await queue(request, { content: arcAnswer(2, 2) }, { content: arcAnswer(3, 2, 'Retried') })
  await page.getByRole('button', { name: 'Generate Arc' }).click()
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Retried')

  await queue(request, { status: 503, times: 3 })
  await page.getByRole('button', { name: 'Regenerate' }).click()
  await expect(page.getByRole('alert')).toContainText(/Your current Arc is unchanged/)
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Retried')
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
})

test('Stop cancels generation and keeps things as they were', async ({ page, request }) => {
  await setup(page, 'stop')
  await queue(request, { content: arcAnswer(3, 2), delayMs: 8000 })

  await page.getByRole('button', { name: 'Generate Arc' }).click()
  await expect(page.getByText('Generating the Arc…')).toBeVisible()
  await page.getByRole('button', { name: 'Stop' }).click()

  await expect(page.getByRole('button', { name: 'Generate Arc' })).toBeVisible()
  await expect(page.getByText(/No Arc yet/)).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('Generate and Regenerate are disabled with a reason, and structure locks, once a Session has started', async ({
  page,
  request
}) => {
  const hero = `Hero ${Date.now()}`
  await seedCharacter(page, hero)
  await setup(page, 'locked')
  await queue(request, { content: arcAnswer(3, 2) })
  await page.getByRole('button', { name: 'Generate Arc' }).click()
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('The Ember Crown')

  await page.locator('select[name=characterId]').selectOption({ label: hero })
  await page.getByRole('button', { name: 'Link Character' }).click()
  await expect(page.getByText(`Playing as ${hero}.`)).toBeVisible()
  await page.getByRole('button', { name: 'Start Session' }).click()
  await expect(page.getByRole('heading', { name: 'Session 1' })).toBeVisible()
  await page.goBack()
  await page.reload()
  await page.waitForLoadState('networkidle')

  const arcSection = page.getByRole('region', { name: 'Arc' })
  await expect(arcSection.getByRole('button', { name: 'Regenerate' })).toBeDisabled()
  await expect(arcSection.getByText(/already started play/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add Act' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Delete Act/ })).toHaveCount(0)

  // Text stays editable and saves.
  await page.getByLabel('Title', { exact: true }).fill('Typo fixed')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await page.reload()
  await page.waitForLoadState('networkidle')
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Typo fixed')
})

test('a Campaign whose Session started without an Arc stays Arc-less and keeps playing', async ({
  page,
  request
}) => {
  const hero = `Hero ${Date.now()}`
  await seedCharacter(page, hero)
  await setup(page, 'plain')
  await page.locator('select[name=characterId]').selectOption({ label: hero })
  await page.getByRole('button', { name: 'Link Character' }).click()
  await expect(page.getByText(`Playing as ${hero}.`)).toBeVisible()
  await queue(request, { content: 'A gate looms in the ash.' })
  await page.getByRole('button', { name: 'Start Session' }).click()
  await expect(page.getByRole('heading', { name: 'Session 1' })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Transcript' })).toContainText(
    'A gate looms in the ash.'
  )
  // The Session plays on with no Arc.
  await control(request, 'answers', {
    answers: [{ content: 'The hinges scream.' }],
    replace: true
  })
  await page.getByLabel('Your action').fill('I push the gate.')
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByRole('list', { name: 'Transcript' })).toContainText('The hinges scream.')
  const campaignUrl = page.url().replace(/\/sessions\/.*$/, '')
  await page.goto(campaignUrl)
  await page.waitForLoadState('networkidle')

  const arcSection = page.getByRole('region', { name: 'Arc' })
  await expect(arcSection.getByText(/No Arc yet/)).toBeVisible()
  await expect(arcSection.getByRole('button', { name: 'Generate Arc' })).toBeDisabled()
  await expect(arcSection.getByText(/already started play/)).toBeVisible()

  // The server refuses too, without touching the model.
  const refused = await page.request.post(
    `${campaignUrl.replace(/\/campaigns\//, '/api/campaigns/')}/arc`,
    {
      data: { action: 'generate' }
    }
  )
  expect(refused.status()).toBe(409)

  const all = (await (await request.get(`${FAKE_LM_STUDIO}/__control/requests`)).json()) as {
    path: string
    body: { messages: { role: string; content: string }[] }
  }[]
  const dm = all
    .filter((r) => r.path === '/v1/chat/completions')
    .filter((r) => !JSON.stringify(r.body.messages).includes('MEMORY EXTRACTION'))
    .at(-1)!.body.messages
  expect(dm.map((m) => m.content).join('\n')).not.toMatch(/\bArc\b/)
})
