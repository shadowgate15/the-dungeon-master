import { expect, test, type APIRequestContext } from '@playwright/test'

const FAKE_LM_STUDIO = 'http://127.0.0.1:1235'

async function setScenario(request: APIRequestContext, scenario: string) {
  const response = await request.post(`${FAKE_LM_STUDIO}/__control/scenario`, {
    data: { scenario }
  })
  expect(response.ok()).toBe(true)
}

async function setChatContent(request: APIRequestContext, content: unknown) {
  const response = await request.post(`${FAKE_LM_STUDIO}/__control/chat-content`, {
    data: content
  })
  expect(response.ok()).toBe(true)
}

async function chatRequests(request: APIRequestContext) {
  const response = await request.get(`${FAKE_LM_STUDIO}/__control/requests`)
  const all = (await response.json()) as { path: string; body: unknown }[]
  return all.filter((r) => r.path === '/v1/chat/completions').map((r) => JSON.stringify(r.body))
}

// The scenario is process-wide state in the fake server.
test.describe.configure({ mode: 'serial' })
test.afterEach(async ({ request }) => setScenario(request, 'ready'))

test('bad output shows an inline error; the failed turn stays out of history; Retry works', async ({
  page,
  request
}) => {
  await setScenario(request, 'bad-output')
  await page.goto('/')
  const panel = page.getByRole('region', { name: 'AI' })
  const before = (await chatRequests(request)).length
  await panel.getByLabel('Message').fill('FAILED-MESSAGE-TEXT')
  await panel.getByRole('button', { name: 'Send' }).click()

  const failed = panel.getByRole('alert')
  await expect(failed).toContainText('could not reply')
  await expect(failed.getByRole('button', { name: 'Retry' })).toBeVisible()
  await expect(panel.getByText('FAILED-MESSAGE-TEXT')).toBeVisible()
  await expect(panel.getByRole('list', { name: 'Proposals' })).toHaveCount(0)
  // The seed card and form stay fully usable.
  await expect(page.getByLabel('Name')).toBeEnabled()
  await page.getByLabel('Name').fill('Still Mine')
  await expect(page.getByLabel('Name')).toHaveValue('Still Mine')
  // The silent retry means two attempts for the one turn.
  expect((await chatRequests(request)).length - before).toBe(2)

  // A later turn does not carry the failed one.
  await setScenario(request, 'ready')
  await setChatContent(request, { reply: 'Back to normal.', proposals: { scale: 'continent' } })
  await panel.getByLabel('Message').fill('SECOND-MESSAGE')
  await panel.getByRole('button', { name: 'Send' }).click()
  await expect(panel.getByText('Back to normal.')).toBeVisible()
  const requests = await chatRequests(request)
  expect(requests[requests.length - 1]).toContain('SECOND-MESSAGE')
  expect(requests[requests.length - 1]).not.toContain('FAILED-MESSAGE-TEXT')

  // Retry resends the failed message and removes the failed marker.
  await failed.getByRole('button', { name: 'Retry' }).click()
  await expect(panel.getByRole('alert')).toHaveCount(0)
  await expect(panel.getByText('FAILED-MESSAGE-TEXT')).toBeVisible()
})

test('Stop cancels a turn that is in flight and leaves a retryable failed turn', async ({
  page,
  request
}) => {
  await setScenario(request, 'hang')
  await page.goto('/')
  const panel = page.getByRole('region', { name: 'AI' })
  await panel.getByLabel('Message').fill('Anyone there?')
  await panel.getByRole('button', { name: 'Send' }).click()

  await expect(panel.getByText('Thinking')).toBeVisible()
  await page.getByLabel('Name').fill('Editable While Waiting')
  await panel.getByRole('button', { name: 'Stop' }).click()

  await expect(panel.getByRole('alert')).toContainText('Stopped')
  await expect(panel.getByText('Thinking')).toBeHidden()
  await expect(panel.getByRole('button', { name: 'Retry' })).toBeEnabled()
  await expect(page.getByLabel('Name')).toHaveValue('Editable While Waiting')

  await setScenario(request, 'ready')
  await setChatContent(request, { reply: 'Here now.', proposals: {} })
  await panel.getByRole('button', { name: 'Retry' }).click()
  await expect(panel.getByText('Here now.')).toBeVisible()
})

test('a reasoning model gets a clear message and disables AI until a successful re-probe', async ({
  page,
  request
}) => {
  await setScenario(request, 'reasoning-model')
  await page.goto('/')
  const panel = page.getByRole('region', { name: 'AI' })
  const before = (await chatRequests(request)).length
  await panel.getByLabel('Message').fill('Hello')
  await panel.getByRole('button', { name: 'Send' }).click()

  await expect(panel.getByRole('alert')).toContainText('usually means a reasoning model')
  await expect(panel.getByRole('alert')).toContainText('qwen3-4b-2507')
  expect((await chatRequests(request)).length - before).toBe(1)
  await expect(panel.getByLabel('Message')).toBeDisabled()
  await expect(panel.getByRole('button', { name: 'Send' })).toBeDisabled()
  await expect(panel.getByRole('button', { name: 'Retry' })).toBeDisabled()
  await expect(page.getByLabel('Name')).toBeEnabled()

  // The lock outlives a reload; only a successful re-probe releases it.
  await page.reload()
  await expect(panel.getByLabel('Message')).toBeDisabled()
  await expect(panel.getByText(/usually means a reasoning model/)).toBeVisible()

  await setScenario(request, 'ready')
  await panel.getByRole('button', { name: 'Check connection' }).click()
  await expect(panel.getByLabel('Message')).toBeEnabled()
})
