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

test('a pending card is dropped when an earlier change invalidates it', async ({
  page,
  request
}) => {
  await setChat(request, {
    reply: 'An elf of the high kind.',
    proposals: { race: 'elf', subrace: 'high-elf' }
  })
  await page.goto('/characters/new')
  await page.waitForLoadState('networkidle')

  const panel = page.getByRole('complementary', { name: 'Creation conversation' })
  await panel.getByLabel('Message').fill('A high elf')
  await panel.getByRole('button', { name: 'Send' }).click()
  const cards = panel.getByRole('list', { name: 'Proposals' }).getByRole('listitem')
  await expect(cards).toHaveCount(2)

  await cards.first().getByRole('button', { name: 'Accept' }).click()
  const subrace = cards.nth(1)
  await expect(subrace.getByRole('button', { name: 'Accept' })).toBeVisible()

  // The player picks another race by hand: the subrace card no longer fits and goes away.
  await page.getByRole('combobox', { name: 'Race', exact: true }).selectOption('dwarf')
  await expect(subrace.getByRole('button', { name: 'Accept' })).toHaveCount(0)
  await expect(subrace.getByText('superseded')).toBeVisible()
})

test('Skills & features proposals are keyed by choice and apply when accepted', async ({
  page,
  request
}) => {
  await setChat(request, {
    reply: 'Two skills for the soldier.',
    proposals: { featurePicks: 'class/fighter/proficiency-0=skill-athletics,skill-history' }
  })
  await page.goto('/characters/new')
  await page.waitForLoadState('networkidle')
  await page.getByRole('combobox', { name: 'Race', exact: true }).selectOption('human')
  await page.getByRole('combobox', { name: 'Class', exact: true }).selectOption('fighter')
  await page.getByRole('combobox', { name: 'Background', exact: true }).selectOption('acolyte')
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Brenna')
  await page
    .getByRole('button', { name: /Skills/ })
    .first()
    .click()

  const panel = page.getByRole('complementary', { name: 'Creation conversation' })
  await panel.getByLabel('Message').fill('Pick my skills')
  await panel.getByRole('button', { name: 'Send' }).click()
  const card = panel.getByRole('list', { name: 'Proposals' }).getByRole('listitem')
  await expect(card).toHaveCount(1)
  await card.getByRole('button', { name: 'Accept' }).click()
  await expect(card.getByText('accepted')).toBeVisible()
})
