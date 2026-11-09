import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { createWorld } from './world-helpers'

const FAKE_LM_STUDIO = 'http://127.0.0.1:1235'

const control = (request: APIRequestContext, path: string, data: unknown) =>
  request.post(`${FAKE_LM_STUDIO}/__control/${path}`, { data })

const queue = (request: APIRequestContext, ...values: string[]) =>
  control(request, 'answers', { answers: values.map((value) => ({ content: { value } })) })

// The fake's scenario and answer queue are process-wide state.
test.describe.configure({ mode: 'serial' })
test.afterEach(async ({ request }) => {
  await control(request, 'scenario', { scenario: 'ready' })
  await control(request, 'answers', { answers: [], replace: true })
})

async function openNewCampaign(page: Page, world: string) {
  await page.goto('/campaigns')
  await page.waitForLoadState('networkidle') // the dialog only becomes a modal after hydration
  await page.getByRole('link', { name: 'New Campaign' }).click()
  const dialog = page.getByRole('dialog', { name: 'New Campaign' })
  await dialog.getByLabel('Add World').selectOption({ label: world })
  await expect(dialog.getByText('Connected')).toBeVisible()
  return dialog
}

test('the Campaign dialog has no chat, and a control on every field but the Worlds', async ({
  page
}) => {
  const world = `Fieldworld ${Date.now()}`
  await createWorld(page, world)
  const dialog = await openNewCampaign(page, world)

  await expect(dialog.getByLabel('Message')).toHaveCount(0)
  for (const label of ['Name', 'Premise', 'Tone', 'Length']) {
    await expect(dialog.getByRole('button', { name: `Generate ${label}` })).toBeVisible()
    await expect(dialog.getByRole('button', { name: `Give feedback on ${label}` })).toBeVisible()
  }
  await expect(dialog.getByRole('button', { name: /Generate World/ })).toHaveCount(0)
})

test('Generate, Feedback and Undo on a field, with the World seed as context', async ({
  page,
  request
}) => {
  const world = `Seedworld ${Date.now()}`
  await createWorld(page, world)
  const dialog = await openNewCampaign(page, world)
  const name = dialog.getByLabel('Name', { exact: true })

  await queue(request, 'Ember Road')
  await dialog.getByRole('button', { name: 'Generate Name' }).click()
  await expect(name).toHaveValue('Ember Road')

  await queue(request, 'Brighter Road')
  await dialog.getByRole('button', { name: 'Give feedback on Name' }).click()
  const feedback = page.getByRole('dialog', { name: 'Feedback on Name' })
  await feedback.getByLabel('What should change?').fill('more hopeful')
  await feedback.getByRole('button', { name: 'Revise' }).click()
  await expect(name).toHaveValue('Brighter Road')

  const sent = (await (await request.get(`${FAKE_LM_STUDIO}/__control/requests`)).json()) as {
    body: unknown
  }[]
  const last = JSON.stringify(sent[sent.length - 1].body)
  expect(last).toContain(world)
  expect(last).toContain('more hopeful')

  await dialog.getByRole('button', { name: 'Undo' }).click()
  await expect(name).toHaveValue('Ember Road')

  await queue(request, 'mysterious')
  await dialog.getByRole('button', { name: 'Generate Tone' }).click()
  await expect(dialog.getByLabel('Tone', { exact: true })).toHaveValue('mysterious')
})

test('an archived World shows a plain error with Dismiss only', async ({
  page,
  request,
  context
}) => {
  const world = `Goneworld ${Date.now()}`
  await createWorld(page, world)
  const dialog = await openNewCampaign(page, world)

  // Archive the World elsewhere while the dialog is still open.
  const other = await context.newPage()
  await other.goto('/')
  await other.waitForLoadState('networkidle')
  await other
    .getByRole('row')
    .filter({ hasText: world })
    .getByRole('button', { name: 'Archive' })
    .click()
  await expect(other.getByRole('row').filter({ hasText: world })).toHaveCount(0)
  await other.close()

  await queue(request, 'Never Used')
  await dialog.getByRole('button', { name: 'Generate Name' }).click()
  const alert = dialog.getByRole('alert')
  await expect(alert).toContainText('archived or deleted')
  await expect(alert.getByRole('button', { name: 'Retry' })).toHaveCount(0)
  await expect(dialog.getByLabel('Name', { exact: true })).toHaveValue('')

  await alert.getByRole('button', { name: 'Dismiss' }).click()
  await expect(alert).toBeHidden()
})
