import { expect, test, type APIRequestContext } from '@playwright/test'
import { openNewWorld } from './world-helpers'

const FAKE_LM_STUDIO = 'http://127.0.0.1:1235'

async function setChatContent(request: APIRequestContext, content: unknown) {
  const response = await request.post(`${FAKE_LM_STUDIO}/__control/chat-content`, {
    data: content
  })
  expect(response.ok()).toBe(true)
}

async function lastChatRequest(request: APIRequestContext) {
  const response = await request.get(`${FAKE_LM_STUDIO}/__control/requests`)
  const all = (await response.json()) as { path: string; body: unknown }[]
  const chats = all.filter((r) => r.path === '/v1/chat/completions')
  return JSON.stringify(chats[chats.length - 1].body)
}

// The canned chat content is process-wide state in the fake server.
test.describe.configure({ mode: 'serial' })

test('drafts proposals, accepts one, dismisses one and sends both facts next turn', async ({
  page,
  request
}) => {
  await setChatContent(request, {
    reply: 'Here is a first draft.',
    proposals: {
      name: 'Eldoria',
      premise: 'A drowned kingdom.',
      genreFlavor: 'dark fantasy'
    }
  })
  await openNewWorld(page)
  const panel = page.getByRole('region', { name: 'AI' })
  await expect(panel.getByLabel('Message')).toBeEnabled()

  await page.getByLabel('Name', { exact: true }).fill('My Own Name')

  // Hold the turn in flight so the pending state can be observed.
  let release!: () => void
  const gate = new Promise<void>((resolve) => (release = resolve))
  await page.route('**/api/world-creation/turn', async (route) => {
    await gate
    await route.continue()
  })

  await panel.getByLabel('Message').fill('Draft me a gloomy world')
  await panel.getByRole('button', { name: 'Send' }).click()

  await expect(panel.getByText('Thinking')).toBeVisible()
  await expect(panel.getByLabel('Message')).toBeDisabled()
  await expect(panel.getByRole('button', { name: 'Send' })).toBeDisabled()
  // The seed card stays editable during the turn.
  await expect(page.getByLabel('Name', { exact: true })).toBeEnabled()
  await page.getByLabel('Name', { exact: true }).fill('Edited While Waiting')
  release()

  await expect(panel.getByText('Here is a first draft.')).toBeVisible()
  await expect(panel.getByText('Thinking')).toBeHidden()
  await expect(panel.getByLabel('Message')).toBeEnabled()

  const cards = panel.getByRole('list', { name: 'Proposals' }).getByRole('listitem')
  await expect(cards).toHaveCount(3)

  // Nothing reaches the seed card until accepted.
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Edited While Waiting')
  await expect(page.getByLabel('Premise')).toHaveValue('')
  await expect(page.getByLabel('Genre flavor')).toHaveValue('')

  await cards.filter({ hasText: 'Eldoria' }).getByRole('button', { name: 'Accept' }).click()
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Eldoria')
  await expect(cards.filter({ hasText: 'Eldoria' }).getByRole('button')).toHaveCount(0)

  await cards.filter({ hasText: 'dark fantasy' }).getByRole('button', { name: 'Dismiss' }).click()
  await expect(page.getByLabel('Genre flavor')).toHaveValue('')

  // A manual edit and the dismissal both travel with the next request.
  await page.getByLabel('Premise').fill('My hand-written premise')
  await setChatContent(request, { reply: 'Anything else?', proposals: {} })
  await panel.getByLabel('Message').fill('Thanks')
  await panel.getByRole('button', { name: 'Send' }).click()
  await expect(panel.getByText('Anything else?')).toBeVisible()

  const sent = await lastChatRequest(request)
  expect(sent).toContain('My hand-written premise')
  expect(sent).toContain('Eldoria')
  expect(sent).toContain('dark fantasy')
  expect(sent).toMatch(/dismissed/i)
  expect(sent).toContain('Draft me a gloomy world')
  expect(sent).toContain('Here is a first draft.')
})

test('the transcript is not persisted across a reload', async ({ page, request }) => {
  await setChatContent(request, { reply: 'A reply that is not saved.', proposals: {} })
  await openNewWorld(page)
  const panel = page.getByRole('region', { name: 'AI' })
  await panel.getByLabel('Message').fill('Hello')
  await panel.getByRole('button', { name: 'Send' }).click()
  await expect(panel.getByText('A reply that is not saved.')).toBeVisible()

  await openNewWorld(page)

  await expect(panel.getByLabel('Message')).toBeEnabled()
  await expect(panel.getByText('A reply that is not saved.')).toBeHidden()
})

test('feedback revises a proposal: the old card collapses only when the revision lands', async ({
  page,
  request
}) => {
  await setChatContent(request, {
    reply: 'A first premise.',
    proposals: { premise: 'A drowned kingdom.', name: 'Eldoria' }
  })
  await openNewWorld(page)
  const panel = page.getByRole('region', { name: 'AI' })
  await panel.getByLabel('Message').fill('Draft me a world')
  await panel.getByRole('button', { name: 'Send' }).click()
  await expect(panel.getByText('A first premise.')).toBeVisible()

  const cards = panel.getByRole('list', { name: 'Proposals' }).getByRole('listitem')
  const oldPremise = cards.filter({ hasText: 'A drowned kingdom.' })
  await expect(oldPremise.getByRole('button', { name: 'Accept' })).toBeVisible()

  let release!: () => void
  const gate = new Promise<void>((resolve) => (release = resolve))
  await page.route('**/api/world-creation/turn', async (route) => {
    await gate
    await route.continue()
  })
  await setChatContent(request, {
    reply: 'Darker it is.',
    proposals: { premise: 'A drowned kingdom haunted by its own dead.' }
  })
  await panel.getByLabel('Message').fill('Make the premise darker')
  await panel.getByRole('button', { name: 'Send' }).click()
  await expect(panel.getByText('Thinking')).toBeVisible()

  // While the revision is in flight the old card is still live.
  await expect(oldPremise.getByRole('button', { name: 'Accept' })).toBeVisible()
  release()

  await expect(panel.getByText('Darker it is.')).toBeVisible()
  await expect(oldPremise).toContainText('superseded')
  await expect(oldPremise.getByRole('button')).toHaveCount(0)
  const revised = cards.filter({ hasText: 'haunted by its own dead' })
  await expect(revised.getByRole('button', { name: 'Accept' })).toBeVisible()
  // The untouched name card stays live.
  await expect(
    cards.filter({ hasText: 'Eldoria' }).getByRole('button', { name: 'Accept' })
  ).toBeVisible()

  // The model was shown the pending premise so it could revise it.
  const sent = await lastChatRequest(request)
  expect(sent).toContain('A drowned kingdom.')
  expect(sent).toContain('Make the premise darker')

  await revised.getByRole('button', { name: 'Accept' }).click()
  await expect(page.getByLabel('Premise')).toHaveValue('A drowned kingdom haunted by its own dead.')
})
