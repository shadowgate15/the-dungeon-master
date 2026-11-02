import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { createWorld } from './world-helpers'

const FAKE_LM_STUDIO = 'http://127.0.0.1:1235'

async function post(request: APIRequestContext, path: string, data: unknown) {
  const response = await request.post(`${FAKE_LM_STUDIO}${path}`, { data })
  expect(response.ok()).toBe(true)
}

const setChat = (r: APIRequestContext, content: unknown) =>
  post(r, '/__control/chat-content', content)

async function chatBodies(request: APIRequestContext) {
  const response = await request.get(`${FAKE_LM_STUDIO}/__control/requests`)
  const all = (await response.json()) as { path: string; body: unknown }[]
  return all.filter((r) => r.path === '/v1/chat/completions').map((r) => JSON.stringify(r.body))
}

async function openNewCampaign(page: Page) {
  await page.goto('/campaigns')
  await page.waitForLoadState('networkidle') // the dialog only becomes a modal after hydration
  await page.getByRole('link', { name: 'New Campaign' }).click()
  return page.getByRole('dialog', { name: 'New Campaign' })
}

// The canned chat content is process-wide state in the fake server.
test.describe.configure({ mode: 'serial' })
test.beforeEach(async ({ request }) => {
  await post(request, '/__control/usage', { promptTokens: 10, completionTokens: 20 })
})

test('proposals fill the Seed card only when accepted, and newer ones supersede', async ({
  page,
  request
}) => {
  const stamp = Date.now()
  const worldName = `Chatworld ${stamp}`
  await createWorld(page, worldName)
  await setChat(request, {
    reply: 'Here is a first draft.',
    proposals: { name: 'Ember Road', tone: 'tense', length: 'short' }
  })

  const dialog = await openNewCampaign(page)
  await dialog.getByLabel('Add World').selectOption({ label: worldName })
  const panel = dialog.getByRole('region', { name: 'AI' })
  await expect(panel.getByLabel('Message')).toBeEnabled()
  await panel.getByLabel('Message').fill('Draft me a tense campaign')
  await panel.getByRole('button', { name: 'Send' }).click()
  await expect(panel.getByText('Here is a first draft.')).toBeVisible()

  const cards = panel.getByRole('list', { name: 'Proposals' }).getByRole('listitem')
  await expect(cards).toHaveCount(3)
  await expect(dialog.getByLabel('Name', { exact: true })).toHaveValue('')
  await expect(dialog.getByLabel('Tone')).toHaveValue('')

  await cards.filter({ hasText: 'Ember Road' }).getByRole('button', { name: 'Accept' }).click()
  await expect(dialog.getByLabel('Name', { exact: true })).toHaveValue('Ember Road')
  await cards.filter({ hasText: 'tense' }).getByRole('button', { name: 'Accept' }).click()
  await expect(dialog.getByLabel('Tone')).toHaveValue('tense')
  await cards.filter({ hasText: 'short' }).getByRole('button', { name: 'Dismiss' }).click()
  await expect(dialog.getByLabel('Length')).toHaveValue('')

  // A newer Proposal for a field supersedes the older pending one.
  await setChat(request, { reply: 'Another take.', proposals: { premise: 'First hook.' } })
  await panel.getByLabel('Message').fill('A premise?')
  await panel.getByRole('button', { name: 'Send' }).click()
  await expect(panel.getByText('Another take.')).toBeVisible()
  await setChat(request, { reply: 'Better one.', proposals: { premise: 'Second hook.' } })
  await panel.getByLabel('Message').fill('Again')
  await panel.getByRole('button', { name: 'Send' }).click()
  await expect(panel.getByText('Better one.')).toBeVisible()
  await expect(panel.getByText('(superseded)')).toHaveCount(1)
  await panel.getByRole('button', { name: 'Accept' }).click()
  await expect(dialog.getByLabel('Premise')).toHaveValue('Second hook.')

  // The meter relies on the provider's count.
  await expect(panel.getByText(/30 \/ 4,096 tokens/)).toBeVisible()
  await expect(panel.getByRole('button', { name: 'Compact now' })).toBeVisible()
})

test('the current World selection is sent each turn without altering proposals', async ({
  page,
  request
}) => {
  const stamp = Date.now()
  const first = `Selone ${stamp}`
  const second = `Seltwo ${stamp}`
  await createWorld(page, first)
  await createWorld(page, second)
  await setChat(request, { reply: 'Noted.', proposals: { name: 'Keep Me' } })

  const dialog = await openNewCampaign(page)
  const panel = dialog.getByRole('region', { name: 'AI' })
  await dialog.getByLabel('Add World').selectOption({ label: first })
  await panel.getByLabel('Message').fill('one')
  await panel.getByRole('button', { name: 'Send' }).click()
  await expect(panel.getByText('Keep Me')).toBeVisible()

  await dialog.getByLabel('Add World').selectOption({ label: second })
  await setChat(request, { reply: 'Noted again.', proposals: {} })
  await panel.getByLabel('Message').fill('two')
  await panel.getByRole('button', { name: 'Send' }).click()
  await expect(panel.getByText('Noted again.')).toBeVisible()
  await expect(panel.getByText('Keep Me')).toBeVisible()
  await expect(panel.getByRole('button', { name: 'Accept' })).toBeVisible()

  const sent = (await chatBodies(request)).at(-1)!
  expect(sent).toContain(first)
  expect(sent).toContain(second)
})

test('worlds-changed shows an inline message and keeps pending Proposals acceptable', async ({
  page,
  request
}) => {
  const stamp = Date.now()
  const stay = `Stayworld ${stamp}`
  const gone = `Goneworld ${stamp}`
  await createWorld(page, stay)
  await createWorld(page, gone)
  await setChat(request, { reply: 'A draft.', proposals: { name: 'Pending Name' } })

  const dialog = await openNewCampaign(page)
  const panel = dialog.getByRole('region', { name: 'AI' })
  await dialog.getByLabel('Add World').selectOption({ label: stay })
  await dialog.getByLabel('Add World').selectOption({ label: gone })
  await panel.getByLabel('Message').fill('hello')
  await panel.getByRole('button', { name: 'Send' }).click()
  await expect(panel.getByText('Pending Name')).toBeVisible()

  // Another tab archives the World mid-conversation.
  const other = await page.context().newPage()
  await other.goto('/')
  await other.waitForLoadState('networkidle')
  await other
    .getByRole('row', { name: new RegExp(gone) })
    .getByRole('button', { name: 'Archive' })
    .click()
  await expect(other.getByRole('status')).toContainText(`Archived ${gone}`)
  await other.close()

  await panel.getByLabel('Message').fill('more')
  await panel.getByRole('button', { name: 'Send' }).click()
  await expect(panel.getByRole('alert').filter({ hasText: /Reload the Worlds/i })).toBeVisible()

  await panel.getByRole('button', { name: 'Accept' }).click()
  await expect(dialog.getByLabel('Name', { exact: true })).toHaveValue('Pending Name')
})

test('the transcript is discarded when the dialog is closed and reopened', async ({
  page,
  request
}) => {
  await createWorld(page, `Discard ${Date.now()}`)
  await setChat(request, { reply: 'Ephemeral reply.', proposals: {} })
  const dialog = await openNewCampaign(page)
  const panel = dialog.getByRole('region', { name: 'AI' })
  await panel.getByLabel('Message').fill('hi there')
  await panel.getByRole('button', { name: 'Send' }).click()
  await expect(panel.getByText('Ephemeral reply.')).toBeVisible()

  await dialog.getByRole('link', { name: 'Close' }).click()
  await page.getByRole('link', { name: 'New Campaign' }).click()
  await expect(panel.getByText('Ephemeral reply.')).toHaveCount(0)
})

test('the edit page has the same chat and discards it on save', async ({ page, request }) => {
  const stamp = Date.now()
  const worldName = `Editchat ${stamp}`
  const name = `Editchat Road ${stamp}`
  await createWorld(page, worldName)
  const dialog = await openNewCampaign(page)
  await dialog.getByLabel('Add World').selectOption({ label: worldName })
  await dialog.getByLabel('Name', { exact: true }).fill(name)
  await dialog.getByLabel('Premise').fill('Escort a relic.')
  await dialog.getByLabel('Tone').selectOption('tense')
  await dialog.getByLabel('Length').selectOption('short')
  await dialog.getByRole('button', { name: 'Create Campaign' }).click()
  await expect(dialog).toBeHidden()

  await page.getByRole('table').getByRole('link', { name }).click()
  await page.waitForLoadState('networkidle')
  await setChat(request, { reply: 'Edit draft.', proposals: { tone: 'dark' } })
  const panel = page.getByRole('region', { name: 'AI' })
  await panel.getByLabel('Message').fill('make it darker')
  await panel.getByRole('button', { name: 'Send' }).click()
  await expect(panel.getByText('Edit draft.')).toBeVisible()
  await panel.getByRole('button', { name: 'Accept' }).click()
  await expect(page.getByLabel('Tone')).toHaveValue('dark')

  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Saved')).toBeVisible()
  await expect(panel.getByText('Edit draft.')).toHaveCount(0)
})
