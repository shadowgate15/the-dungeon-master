import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { expandArc } from './arc-helpers'
import { createWorld } from './world-helpers'

const FAKE_LM_STUDIO = 'http://127.0.0.1:1235'

const control = (request: APIRequestContext, path: string, data: unknown) =>
  request.post(`${FAKE_LM_STUDIO}/__control/${path}`, { data })

/** The model's answers for one Arc: the skeleton, then one Beats answer per Act. */
const arcAnswers = (acts: number, beats: number, title = 'The Ember Crown', delayMs?: number) => [
  {
    content: {
      title,
      premise: 'A relic wakes.',
      stakes: 'The valley burns.',
      acts: Array.from({ length: acts }, (_, a) => ({
        name: `Act ${a + 1} name`,
        purpose: 'Things escalate.'
      })),
      resolution: 'The relic is destroyed.'
    },
    delayMs
  },
  ...Array.from({ length: acts }, (_, a) => ({
    content: {
      beats: Array.from({ length: beats }, (_, b) => ({
        title: `Beat ${a + 1}.${b + 1}`,
        description: 'Something happens.'
      }))
    }
  }))
]

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
  await expandArc(page)
}

async function setup(page: Page, label: string) {
  const stamp = Date.now()
  const world = `Planworld ${label} ${stamp}`
  const campaign = `Plan ${label} ${stamp}`
  await createWorld(page, world)
  await openCampaign(page, campaign, world)
  return { world, campaign, stamp }
}

test('generates a draft Arc, edits it, accepts it', async ({ page, request }) => {
  await setup(page, 'flow')
  await expect(page.getByText(/No Arc yet/)).toBeVisible()
  await queue(request, ...arcAnswers(3, 2))

  await page.getByRole('button', { name: 'Generate Arc' }).click()
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('The Ember Crown')
  await expect(page.getByRole('button', { name: 'Accept Arc' })).toBeVisible()

  await page.getByLabel('Title', { exact: true }).fill('A Better Title')
  await page.getByRole('button', { name: 'Accept Arc' }).click()
  await expect(page.getByRole('button', { name: 'Accept Arc' })).toHaveCount(0)

  await page.reload()
  await page.waitForLoadState('networkidle')
  await expandArc(page)
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('A Better Title')
})

test('regenerate is free on a draft; on an accepted Arc it asks first', async ({
  page,
  request
}) => {
  await setup(page, 'regen')
  await queue(request, ...arcAnswers(3, 2, 'First'))
  await page.getByRole('button', { name: 'Generate Arc' }).click()
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('First')

  await queue(request, ...arcAnswers(3, 2, 'Second'))
  await page.getByRole('button', { name: 'Regenerate' }).click()
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Second')

  await page.getByRole('button', { name: 'Accept Arc' }).click()
  await expect(page.getByRole('button', { name: 'Accept Arc' })).toHaveCount(0)

  await queue(request, ...arcAnswers(3, 2, 'Third'))
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
  // The skeleton has the wrong size first (2 Acts for a short Campaign); only that call is
  // retried, so the next answer is a valid skeleton, then one Beats answer per Act.
  await queue(request, arcAnswers(2, 2)[0], ...arcAnswers(3, 2, 'Retried'))
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
  await queue(request, ...arcAnswers(3, 2, 'The Ember Crown', 8000))

  await page.getByRole('button', { name: 'Generate Arc' }).click()
  await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible()
  await page.getByRole('button', { name: 'Stop' }).click()

  await expect(page.getByRole('button', { name: 'Generate Arc' })).toBeVisible()
  await expect(page.getByText(/No Arc yet/)).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
})
