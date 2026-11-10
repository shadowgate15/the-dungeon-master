import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { openNewWorld } from './world-helpers'

const FAKE_LM_STUDIO = 'http://127.0.0.1:1235'

async function setScenario(request: APIRequestContext, scenario: string) {
  const response = await request.post(`${FAKE_LM_STUDIO}/__control/scenario`, {
    data: { scenario }
  })
  expect(response.ok()).toBe(true)
}

// The details sit behind the chip; open it (a no-op if already open).
async function openChip(page: Page) {
  const details = page.getByRole('region', { name: 'AI' }).locator('details')
  if ((await details.getAttribute('open')) === null) await details.locator('summary').click()
}

async function closeChip(page: Page) {
  const details = page.getByRole('region', { name: 'AI' }).locator('details')
  if ((await details.getAttribute('open')) !== null) await details.locator('summary').click()
}

const generate = (page: Page) => page.getByRole('button', { name: 'Generate Name' })

// The scenario is process-wide state in the fake server, so these tests must not overlap.
test.describe.configure({ mode: 'serial' })

test.afterEach(async ({ request }) => {
  await setScenario(request, 'ready')
})

test('shows the model and a connected status when LM Studio is ready', async ({ page }) => {
  await openNewWorld(page)

  const panel = page.getByRole('region', { name: 'AI' })
  await expect(panel.getByText('fake-model')).toBeVisible()
  await openChip(page)
  await expect(panel.getByText('Connected')).toBeVisible()
  await expect(generate(page)).toBeEnabled()
})

test('not connected recovers after Check connection', async ({ page, request }) => {
  await setScenario(request, 'unreachable')
  await openNewWorld(page)

  const panel = page.getByRole('region', { name: 'AI' })
  await openChip(page)
  await expect(panel.getByText('Not connected')).toBeVisible()
  await openChip(page)
  await expect(panel.getByText(/server configuration/i)).toBeVisible()
  await expect(generate(page)).toBeDisabled()

  // The form still works as in manual mode.
  await expect(page.getByLabel('Name', { exact: true })).toBeEnabled()

  await setScenario(request, 'ready')
  await openChip(page)
  await panel.getByRole('button', { name: 'Check connection' }).click()

  await openChip(page)
  await expect(panel.getByText('Connected')).toBeVisible()
  await expect(generate(page)).toBeEnabled()
})

test('names the configured model when LM Studio does not have it', async ({ page, request }) => {
  await setScenario(request, 'model-missing')
  await openNewWorld(page)

  const panel = page.getByRole('region', { name: 'AI' })
  await openChip(page)
  await expect(panel.getByText(/fake-model.*not available/i)).toBeVisible()
  await expect(generate(page)).toBeDisabled()
})

test('the first generate probes: LM Studio stopping after page load shows not connected', async ({
  page,
  request
}) => {
  await openNewWorld(page)
  const panel = page.getByRole('region', { name: 'AI' })
  await openChip(page)
  await expect(panel.getByText('Connected')).toBeVisible()
  await closeChip(page)
  await page.waitForLoadState('networkidle')

  await setScenario(request, 'unreachable')
  await generate(page).click()

  await openChip(page)
  await expect(panel.getByText('Not connected')).toBeVisible()
  await expect(generate(page)).toBeDisabled()
  await expect(page.getByLabel('Name', { exact: true })).toBeEnabled()
})

test('the first generate reports a model that is no longer available', async ({
  page,
  request
}) => {
  await openNewWorld(page)
  const panel = page.getByRole('region', { name: 'AI' })
  await openChip(page)
  await expect(panel.getByText('Connected')).toBeVisible()
  await closeChip(page)
  await page.waitForLoadState('networkidle')

  await setScenario(request, 'model-missing')
  await generate(page).click()

  await openChip(page)
  await expect(panel.getByText(/fake-model.*not available/i)).toBeVisible()
})

test('never exposes the LM Studio base URL to the browser', async ({ page }) => {
  const seen: string[] = []
  page.on('response', async (response) => {
    if (response.url().startsWith('http://localhost:4173')) {
      seen.push(await response.text().catch(() => ''))
    }
  })
  await openNewWorld(page)
  await openChip(page)
  await expect(page.getByText('Connected')).toBeVisible()

  expect((await page.content()).includes('127.0.0.1:1235')).toBe(false)
  for (const body of seen) expect(body).not.toContain('127.0.0.1:1235')
})

test('a reasoning model locks every field button until Check connection', async ({
  page,
  request
}) => {
  await setScenario(request, 'reasoning-model')
  await openNewWorld(page)
  const panel = page.getByRole('region', { name: 'AI' })
  await openChip(page)
  await expect(panel.getByText('Connected')).toBeVisible()
  await closeChip(page)

  await generate(page).click()
  await openChip(page)
  await expect(panel.getByText(/reasoning model/i)).toBeVisible()
  for (const label of ['Name', 'Premise', 'Scale']) {
    await expect(page.getByRole('button', { name: `Generate ${label}` })).toBeDisabled()
  }
  await expect(page.getByLabel('Name', { exact: true })).toBeEnabled()

  await setScenario(request, 'ready')
  await openChip(page)
  await panel.getByRole('button', { name: 'Check connection' }).click()
  await expect(generate(page)).toBeEnabled()
})
