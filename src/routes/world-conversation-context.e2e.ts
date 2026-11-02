import { expect, test, type APIRequestContext, type Locator } from '@playwright/test'

const FAKE_LM_STUDIO = 'http://127.0.0.1:1235'

async function post(request: APIRequestContext, path: string, data: unknown) {
  const response = await request.post(`${FAKE_LM_STUDIO}${path}`, { data })
  expect(response.ok()).toBe(true)
}

const setScenario = (r: APIRequestContext, scenario: string) =>
  post(r, '/__control/scenario', { scenario })
const setUsage = (r: APIRequestContext, promptTokens: number, completionTokens: number) =>
  post(r, '/__control/usage', { promptTokens, completionTokens })

async function chatBodies(request: APIRequestContext) {
  const response = await request.get(`${FAKE_LM_STUDIO}/__control/requests`)
  const all = (await response.json()) as { path: string; body: unknown }[]
  return all.filter((r) => r.path === '/v1/chat/completions').map((r) => JSON.stringify(r.body))
}

const isSummary = (body: string) => body.includes('"summary":{')

// The scenario, usage and canned content are process-wide state in the fake server.
test.describe.configure({ mode: 'serial' })
test.beforeEach(async ({ request }) => {
  await post(request, '/__control/chat-content', { reply: 'Noted.', proposals: {} })
  await setUsage(request, 10, 20)
})
test.afterEach(async ({ request }) => setScenario(request, 'ready'))

/** Sends one message and waits until its reply has landed. */
async function say(panel: Locator, text: string) {
  const replies = panel.getByText('Noted.', { exact: true })
  const before = await replies.count()
  await panel.getByLabel('Message').fill(text)
  await panel.getByRole('button', { name: 'Send' }).click()
  await expect(replies).toHaveCount(before + 1)
}

test('the meter warns near the limit, then compacts automatically and keeps the transcript', async ({
  page,
  request
}) => {
  await page.goto('/')
  const panel = page.getByRole('region', { name: 'AI' })
  const meter = panel.getByRole('meter', { name: 'Context' })
  await expect(meter).toBeVisible()

  for (const word of ['alpha', 'bravo', 'charlie', 'delta']) await say(panel, `${word} message`)
  await expect(panel.getByText('30 / 4,096 tokens')).toBeVisible()
  await expect(panel.getByText(/almost full/i)).toHaveCount(0)

  // The provider reports 3,400 tokens used: past 80% of the 4,096 limit.
  await setUsage(request, 3000, 400)
  await say(panel, 'echo message')
  await expect(panel.getByText('3,400 / 4,096 tokens')).toBeVisible()
  await expect(panel.getByText(/almost full/i)).toBeVisible()
  expect((await chatBodies(request)).filter(isSummary)).toHaveLength(0)

  // The next send would cross the threshold, so it compacts first.
  await setUsage(request, 100, 20)
  const before = (await chatBodies(request)).length
  await say(panel, 'foxtrot message')

  const bodies = (await chatBodies(request)).slice(before)
  expect(bodies).toHaveLength(2)
  expect(isSummary(bodies[0])).toBe(true)
  expect(bodies[0]).toContain('alpha message')
  expect(isSummary(bodies[1])).toBe(false)
  expect(bodies[1]).toContain('A fake summary of the earlier conversation.')
  expect(bodies[1]).not.toContain('alpha message')
  expect(bodies[1]).toContain('foxtrot message')

  // Model-facing only: every message is still visible, with a divider, and the meter shrinks.
  await expect(panel.getByRole('separator')).toHaveCount(1)
  await expect(panel.getByText('alpha message')).toBeVisible()
  await expect(panel.getByText('foxtrot message')).toBeVisible()
  await expect(panel.getByText('120 / 4,096 tokens')).toBeVisible()
  await expect(panel.getByText(/almost full/i)).toHaveCount(0)
})

test('Compact now summarizes on request and the meter reflects the compacted size', async ({
  page,
  request
}) => {
  await page.goto('/')
  const panel = page.getByRole('region', { name: 'AI' })
  const compact = panel.getByRole('button', { name: 'Compact now' })
  await expect(compact).toBeDisabled()

  for (const word of ['alpha', 'bravo', 'charlie', 'delta']) await say(panel, `${word} message`)
  await expect(compact).toBeEnabled()
  const before = (await chatBodies(request)).length

  await compact.click()

  await expect(panel.getByRole('separator')).toHaveCount(1)
  await expect(panel.getByText('alpha message')).toBeVisible()
  const bodies = (await chatBodies(request)).slice(before)
  expect(bodies).toHaveLength(1)
  expect(isSummary(bodies[0])).toBe(true)
  // No response has measured the compacted prompt yet, so the meter shows an estimate.
  await expect(panel.getByText(/^~[\d,]+ \/ 4,096 tokens/)).toBeVisible()
  // Nothing older than the verbatim tail is left to compact.
  await expect(compact).toBeDisabled()
})

test.describe('when compaction fails', () => {
  async function failCompaction(
    page: import('@playwright/test').Page,
    request: APIRequestContext,
    name = ''
  ) {
    await setUsage(request, 3000, 400)
    await page.goto('/')
    if (name) await page.getByLabel('Name').fill(name)
    const panel = page.getByRole('region', { name: 'AI' })
    for (const word of ['alpha', 'bravo', 'charlie', 'delta']) await say(panel, `${word} message`)
    await setScenario(request, 'summary-fails')
    const before = (await chatBodies(request)).length
    await panel.getByLabel('Message').fill('unsent message')
    await panel.getByRole('button', { name: 'Send' }).click()

    const alert = panel.getByRole('alert')
    await expect(alert).toContainText('could not be summarized')
    // One silent retry, and the turn itself was never sent.
    const bodies = (await chatBodies(request)).slice(before)
    expect(bodies).toHaveLength(2)
    expect(bodies.every(isSummary)).toBe(true)
    await expect(panel.getByLabel('Message')).toBeDisabled()
    await expect(panel.getByRole('button', { name: 'Send' })).toBeDisabled()
    return { panel, alert }
  }

  test('blocks input; "Finish on the seed card" closes the chat but keeps the transcript', async ({
    page,
    request
  }) => {
    const { panel, alert } = await failCompaction(page, request)

    await alert.getByRole('button', { name: 'Finish on the seed card' }).click()

    await expect(panel.getByRole('alert')).toHaveCount(0)
    await expect(panel.getByText('alpha message')).toBeVisible()
    await expect(panel.getByLabel('Message')).toBeDisabled()
    await expect(panel.getByText(/finish your world on the seed card/i)).toBeVisible()
    await expect(page.getByLabel('Name')).toBeEnabled()
  })

  test('blocks input; "Clear chat" empties the chat and keeps the seed card', async ({
    page,
    request
  }) => {
    const { panel, alert } = await failCompaction(page, request, 'Kept Name')

    await alert.getByRole('button', { name: 'Clear chat' }).click()

    await expect(panel.getByRole('alert')).toHaveCount(0)
    await expect(panel.getByText('alpha message')).toHaveCount(0)
    await expect(panel.getByLabel('Message')).toBeEnabled()
    await expect(page.getByLabel('Name')).toHaveValue('Kept Name')
  })
})
