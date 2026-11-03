import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { createWorld } from './world-helpers'

const FAKE_LM_STUDIO = 'http://127.0.0.1:1235'

async function setChat(request: APIRequestContext, content: unknown) {
  const response = await request.post(`${FAKE_LM_STUDIO}/__control/chat-content`, {
    data: content
  })
  expect(response.ok()).toBe(true)
}

const row = (page: Page, name: string) => page.getByRole('row').filter({ hasText: name })

async function setWorldArchived(page: Page, world: string, archived: boolean) {
  await page.goto(archived ? '/' : '/?view=archived')
  await page.waitForLoadState('networkidle')
  await row(page, world)
    .getByRole('button', { name: archived ? 'Archive' : 'Restore' })
    .click()
  await expect(row(page, world)).toHaveCount(0)
}

// The whole lifecycle of a Campaign in one story. The per-feature specs
// (campaigns, campaign-edit, campaign-lifecycle, campaign-conversation) cover the
// edge cases; this one proves the pieces work together, with the model stubbed.
test('a Campaign goes from AI-assisted creation through edit, filter, read-only, archive, restore and delete', async ({
  page,
  request
}) => {
  const stamp = Date.now()
  const ash = `Flowash ${stamp}`
  const bramble = `Flowbramble ${stamp}`
  const name = `Ember Road ${stamp}`
  const other = `Other Road ${stamp}`
  await createWorld(page, ash)
  await createWorld(page, bramble)

  // Create with the AI: Proposals fill the Seed card only once accepted.
  await setChat(request, {
    reply: 'Here is a first draft.',
    proposals: { name, premise: 'Escort a relic.', tone: 'tense', length: 'short' }
  })
  await page.goto('/campaigns')
  await page.waitForLoadState('networkidle') // the dialog only becomes a modal after hydration
  await page.getByRole('link', { name: 'New Campaign' }).click()
  const dialog = page.getByRole('dialog', { name: 'New Campaign' })
  await dialog.getByLabel('Add World').selectOption({ label: ash })
  const panel = dialog.getByRole('region', { name: 'AI' })
  await panel.getByLabel('Message').fill('Draft me a tense campaign')
  await panel.getByRole('button', { name: 'Send' }).click()
  await expect(panel.getByText('Here is a first draft.')).toBeVisible()
  await expect(dialog.getByLabel('Name', { exact: true })).toHaveValue('')
  const create = dialog.getByRole('button', { name: 'Create Campaign' })
  await expect(create).toBeDisabled()
  const cards = panel.getByRole('list', { name: 'Proposals' }).getByRole('listitem')
  await expect(cards).toHaveCount(4)
  for (let remaining = 4; remaining > 0; remaining--) {
    await panel.getByRole('button', { name: 'Accept' }).first().click()
    await expect(panel.getByRole('button', { name: 'Accept' })).toHaveCount(remaining - 1)
  }
  await expect(dialog.getByLabel('Name', { exact: true })).toHaveValue(name)
  await expect(dialog.getByLabel('Length')).toHaveValue('short')
  await create.click()
  await expect(dialog).toBeHidden()
  await expect(row(page, name).getByText(ash)).toBeVisible()
  await expect(row(page, name).getByRole('cell', { name: 'tense', exact: true })).toBeVisible()

  // Edit, with the AI too: change the tone through a Proposal and add a second World.
  await page.getByRole('table').getByRole('link', { name }).click()
  await page.waitForLoadState('networkidle')
  await setChat(request, { reply: 'Darker?', proposals: { tone: 'dark' } })
  const editPanel = page.getByRole('region', { name: 'AI' })
  await editPanel.getByLabel('Message').fill('make it darker')
  await editPanel.getByRole('button', { name: 'Send' }).click()
  await expect(editPanel.getByText('Darker?')).toBeVisible()
  await editPanel.getByRole('button', { name: 'Accept' }).click()
  await page.getByLabel('Add World').selectOption({ label: bramble })
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Saved')).toBeVisible()
  await page.getByRole('link', { name: 'Back to Campaigns' }).click()
  await expect(row(page, name).getByRole('cell', { name: 'dark', exact: true })).toBeVisible()
  await expect(row(page, name).getByText(bramble)).toBeVisible()

  // A second Campaign, set only in the first World, to exercise the World filter.
  await page.waitForLoadState('networkidle')
  await page.getByRole('link', { name: 'New Campaign' }).click()
  const second = page.getByRole('dialog', { name: 'New Campaign' })
  await second.getByLabel('Add World').selectOption({ label: ash })
  await second.getByLabel('Name', { exact: true }).fill(other)
  await second.getByLabel('Premise').fill('Hold the pass.')
  await second.getByLabel('Tone').selectOption('epic')
  await second.getByLabel('Length').selectOption('long')
  await second.getByRole('button', { name: 'Create Campaign' }).click()
  await expect(second).toBeHidden()

  await row(page, name).getByRole('link', { name: bramble }).click()
  await expect(page.getByText(`Showing Campaigns set in ${bramble}`)).toBeVisible()
  await expect(row(page, name)).toBeVisible()
  await expect(row(page, other)).toHaveCount(0)
  await page.getByRole('link', { name: 'Clear filter' }).click()
  await expect(row(page, other)).toBeVisible()

  // An archived World blocks its Campaign (read-only) until it is restored.
  await setWorldArchived(page, bramble, true)
  await page.goto('/campaigns')
  await expect(row(page, name).getByText('Read-only', { exact: true })).toBeVisible()
  await expect(row(page, name).getByText(`Restore ${bramble} to edit this Campaign.`)).toBeVisible()
  await expect(row(page, other).getByText('Read-only')).toHaveCount(0)
  await page.getByRole('table').getByRole('link', { name }).click()
  await expect(page.getByText(/read-only/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0)
  await setWorldArchived(page, bramble, false)
  await page.goto('/campaigns')
  await expect(row(page, name).getByText('Read-only')).toHaveCount(0)

  // Archive, find it under Archived, restore.
  await page.waitForLoadState('networkidle')
  await row(page, name).getByRole('button', { name: 'Archive' }).click()
  await expect(row(page, name)).toHaveCount(0)
  await page.getByRole('link', { name: /^Archived/ }).click()
  await row(page, name).getByRole('button', { name: 'Restore' }).click()
  await expect(row(page, name)).toHaveCount(0)
  await page.getByRole('link', { name: /^Active/ }).click()
  await expect(row(page, name)).toBeVisible()

  // Delete needs confirmation and leaves the Worlds alone.
  await row(page, name).getByRole('button', { name: 'Delete' }).click()
  await row(page, name).getByRole('button', { name: 'Confirm delete' }).click()
  await expect(page.getByRole('status')).toContainText(`Deleted ${name}`)
  await expect(row(page, name)).toHaveCount(0)
  await expect(row(page, other)).toBeVisible()
  await page.goto('/')
  await expect(row(page, ash)).toBeVisible()
  await expect(row(page, bramble)).toBeVisible()
})
