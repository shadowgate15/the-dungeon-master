import { expect, test, type APIRequestContext } from '@playwright/test'

const FAKE_LM_STUDIO = 'http://127.0.0.1:1235'

async function setChat(request: APIRequestContext, content: unknown) {
  const response = await request.post(`${FAKE_LM_STUDIO}/__control/chat-content`, { data: content })
  expect(response.ok()).toBe(true)
}

// The canned chat content is process-wide state in the fake server.
test.describe.configure({ mode: 'serial' })

test('Concept proposals apply only when accepted and dismissed ones change nothing', async ({
  page,
  request
}) => {
  await setChat(request, {
    reply: 'A sturdy start.',
    proposals: { name: 'Brenna', race: 'dwarf', class: 'cleric' }
  })
  await page.goto('/characters/new')
  await page.waitForLoadState('networkidle')

  const panel = page.getByRole('complementary', { name: 'Creation conversation' })
  await expect(panel.getByLabel('Message')).toBeEnabled()
  await panel.getByLabel('Message').fill('A gruff dwarven cleric')
  await panel.getByRole('button', { name: 'Send' }).click()
  await expect(panel.getByText('A sturdy start.')).toBeVisible()

  const cards = panel.getByRole('list', { name: 'Proposals' }).getByRole('listitem')
  await expect(cards).toHaveCount(3)
  await expect(page.getByRole('combobox', { name: 'Race', exact: true })).toHaveValue('')

  await cards.filter({ hasText: 'dwarf' }).getByRole('button', { name: 'Accept' }).click()
  await expect(page.getByRole('combobox', { name: 'Race', exact: true })).toHaveValue('dwarf')
  await cards.filter({ hasText: 'Brenna' }).getByRole('button', { name: 'Accept' }).click()
  await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('Brenna')
  await cards.filter({ hasText: 'cleric' }).getByRole('button', { name: 'Dismiss' }).click()
  await expect(page.getByRole('combobox', { name: 'Class', exact: true })).toHaveValue('')
})

test('an illegal proposal never reaches the player: the turn fails with a retry', async ({
  page,
  request
}) => {
  await setChat(request, { reply: 'Nope.', proposals: { race: 'space-wizard' } })
  await page.goto('/characters/new')
  await page.waitForLoadState('networkidle')

  const panel = page.getByRole('complementary', { name: 'Creation conversation' })
  await panel.getByLabel('Message').fill('Something odd')
  await panel.getByRole('button', { name: 'Send' }).click()
  await expect(panel.getByText(/Failed:/)).toBeVisible()
  await expect(panel.getByRole('list', { name: 'Proposals' })).toHaveCount(0)
  await expect(panel.getByRole('button', { name: 'Retry' })).toBeVisible()
})
