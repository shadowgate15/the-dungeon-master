import { expect, test, type APIRequestContext } from '@playwright/test'

const FAKE_LM_STUDIO = 'http://127.0.0.1:1235'

async function setScenario(request: APIRequestContext, scenario: string) {
  const response = await request.post(`${FAKE_LM_STUDIO}/__control/scenario`, {
    data: { scenario }
  })
  expect(response.ok()).toBe(true)
}

// The scenario is process-wide state in the fake server, so these tests must not overlap.
test.describe.configure({ mode: 'serial' })

test.afterEach(async ({ request }) => {
  await setScenario(request, 'ready')
})

test('shows the model and a connected status when LM Studio is ready', async ({ page }) => {
  await page.goto('/')

  const panel = page.getByRole('region', { name: 'AI' })
  await expect(panel.getByText('fake-model')).toBeVisible()
  await expect(panel.getByText('Connected')).toBeVisible()
  await expect(panel.getByLabel('Message')).toBeEnabled()
})

test('not connected recovers after Check connection', async ({ page, request }) => {
  await setScenario(request, 'unreachable')
  await page.goto('/')

  const panel = page.getByRole('region', { name: 'AI' })
  await expect(panel.getByText('Not connected')).toBeVisible()
  await expect(panel.getByText(/server configuration/i)).toBeVisible()
  await expect(panel.getByLabel('Message')).toBeDisabled()
  await expect(panel.getByRole('button', { name: 'Send' })).toBeDisabled()

  // The form still works as in manual mode.
  await expect(page.getByLabel('Name')).toBeEnabled()

  await setScenario(request, 'ready')
  await panel.getByRole('button', { name: 'Check connection' }).click()

  await expect(panel.getByText('Connected')).toBeVisible()
  await expect(panel.getByLabel('Message')).toBeEnabled()
})

test('names the configured model when LM Studio does not have it', async ({ page, request }) => {
  await setScenario(request, 'model-missing')
  await page.goto('/')

  const panel = page.getByRole('region', { name: 'AI' })
  await expect(panel.getByText(/fake-model.*not available/i)).toBeVisible()
  await expect(panel.getByLabel('Message')).toBeDisabled()
})

test('never exposes the LM Studio base URL to the browser', async ({ page }) => {
  const seen: string[] = []
  page.on('response', async (response) => {
    if (response.url().startsWith('http://localhost:4173')) {
      seen.push(await response.text().catch(() => ''))
    }
  })
  await page.goto('/')
  await expect(page.getByText('Connected')).toBeVisible()

  expect((await page.content()).includes('127.0.0.1:1235')).toBe(false)
  for (const body of seen) expect(body).not.toContain('127.0.0.1:1235')
})
