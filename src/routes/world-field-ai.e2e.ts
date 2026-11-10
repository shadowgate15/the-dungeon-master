import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { openNewWorld } from './world-helpers'

const FAKE_LM_STUDIO = 'http://127.0.0.1:1235'

const control = (request: APIRequestContext, path: string, data: unknown) =>
  request.post(`${FAKE_LM_STUDIO}/__control/${path}`, { data })

type Answer = { content: unknown; delayMs?: number }
const queue = (request: APIRequestContext, ...answers: Answer[]) =>
  control(request, 'answers', { answers })

// The fake's scenario and answer queue are process-wide state.
test.describe.configure({ mode: 'serial' })
test.afterEach(async ({ request }) => {
  await control(request, 'scenario', { scenario: 'ready' })
  await control(request, 'answers', { answers: [], replace: true })
})

async function ready(page: Page) {
  await openNewWorld(page)
  await expect(page.getByText('Connected')).toBeVisible()
}

test('the World dialog has no chat and a control on every AI field', async ({ page }) => {
  await ready(page)

  await expect(page.getByLabel('Message')).toHaveCount(0)
  for (const label of ['Name', 'Premise', 'Genre flavor', 'Scale', 'Magic level', 'Tech level']) {
    await expect(page.getByRole('button', { name: `Generate ${label}` })).toBeVisible()
    await expect(page.getByRole('button', { name: `Give feedback on ${label}` })).toBeVisible()
  }
})

test('Generate, Feedback and Undo on a field; the result is saved with the World', async ({
  page,
  request
}) => {
  await ready(page)
  const name = page.getByLabel('Name', { exact: true })
  // Feedback needs something to revise.
  await expect(page.getByRole('button', { name: 'Give feedback on Name' })).toHaveAttribute(
    'aria-disabled',
    'true'
  )

  await queue(request, { content: { value: 'The Salt Coast' } })
  await page.getByRole('button', { name: 'Generate Name' }).click()
  await expect(name).toHaveValue('The Salt Coast')
  await expect(page.getByText('Name updated by AI.')).toBeVisible()

  await queue(request, { content: { value: 'The Brighter Coast' } })
  await page.getByRole('button', { name: 'Give feedback on Name' }).click()
  const dialog = page.getByRole('dialog', { name: 'Feedback on Name' })
  await expect(dialog).toContainText('The Salt Coast')
  await dialog.getByLabel('What should change?').fill('more hopeful')
  await dialog.getByRole('button', { name: 'Revise' }).click()
  await expect(name).toHaveValue('The Brighter Coast')

  // The feedback call carried the current value and the note.
  const sent = (await (await request.get(`${FAKE_LM_STUDIO}/__control/requests`)).json()) as {
    body: unknown
  }[]
  const last = JSON.stringify(sent[sent.length - 1].body)
  expect(last).toContain('The Salt Coast')
  expect(last).toContain('more hopeful')

  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(name).toHaveValue('The Salt Coast')

  // An enum field writes a legal option.
  await queue(request, { content: { value: 'gothic horror' } })
  await page.getByRole('button', { name: 'Generate Genre flavor' }).click()
  await expect(page.getByLabel('Genre flavor', { exact: true })).toHaveValue('gothic horror')

  await page.getByRole('button', { name: 'Create World' }).click()
  await expect(page.getByRole('dialog', { name: 'New World' })).toBeHidden()
  await expect(page.getByText('The Salt Coast')).toBeVisible()
})

test('a manual edit after an AI write expires Undo', async ({ page, request }) => {
  await ready(page)
  await queue(request, { content: { value: 'Eldoria' } })
  await page.getByRole('button', { name: 'Generate Name' }).click()
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Eldoria')

  await page.getByLabel('Name', { exact: true }).fill('Eldoria Reborn')

  await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(0)
})

test('a failure shows Retry; Retry succeeds; Stop keeps the prior value', async ({
  page,
  request
}) => {
  await ready(page)
  const name = page.getByLabel('Name', { exact: true })
  await name.fill('Mine')

  await control(request, 'scenario', { scenario: 'bad-output' })
  await page.getByRole('button', { name: 'Generate Name' }).click()
  const alert = page.getByRole('alert')
  await expect(alert).toBeVisible()
  await expect(name).toHaveValue('Mine')

  await control(request, 'scenario', { scenario: 'ready' })
  await queue(request, { content: { value: 'Second Try' } })
  await alert.getByRole('button', { name: 'Retry' }).click()
  await expect(name).toHaveValue('Second Try')
  await expect(alert).toBeHidden()

  await control(request, 'scenario', { scenario: 'hang' })
  await page.getByRole('button', { name: 'Generate Name' }).click()
  await expect(name).toBeDisabled()
  await expect(page.getByText('Generating name…')).toBeVisible()
  await page.getByRole('button', { name: 'Stop generating Name' }).click()
  await expect(name).toBeEnabled()
  await expect(name).toHaveValue('Second Try')
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('two fields pending at once resolve out of order; other fields stay usable', async ({
  page,
  request
}) => {
  await ready(page)
  await queue(
    request,
    { content: { value: 'Slow Name' }, delayMs: 1500 },
    { content: { value: 'continent' } }
  )

  await page.getByRole('button', { name: 'Generate Name' }).click()
  await expect(page.getByLabel('Name', { exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Generate Scale' }).click()

  await expect(page.getByLabel('Scale', { exact: true })).toHaveValue('continent')
  await expect(page.getByLabel('Name', { exact: true })).toBeDisabled()
  await page.getByLabel('Premise', { exact: true }).fill('Typed while waiting')
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Slow Name')
  await expect(page.getByLabel('Premise', { exact: true })).toHaveValue('Typed while waiting')
  await expect(page.getByLabel('Scale', { exact: true })).toHaveValue('continent')
})
