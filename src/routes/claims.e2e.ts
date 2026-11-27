import { expect, test, type Page } from '@playwright/test'
import { unique } from '../testing/unique'
import { fighterDraft } from '../lib/server/character/test-characters'
import { startFakeDm, type FakeDm } from '../testing/fake-dm'
import { E2E_HOME } from '../../playwright.config'

/** Creates a Campaign through the New Campaign dialog; returns its id and folder. */
async function createCampaign(page: Page, name: string) {
  await page.goto('/campaigns')
  await page.waitForLoadState('networkidle')
  await page.getByRole('link', { name: 'New Campaign' }).click()
  const dialog = page.getByRole('dialog', { name: 'New Campaign' })
  await dialog.getByLabel('Name', { exact: true }).fill(name)
  const folder = await dialog.getByLabel('Folder').inputValue()
  await dialog.getByRole('button', { name: 'Create Campaign' }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  return { id: page.url().split('/').at(-1)!, folder }
}

/** Saves a finished Fighter into the Party through the Party step's draft API. */
async function addFighter(page: Page, campaign: string, name: string) {
  await page.goto(`/campaigns/${campaign}/party`)
  await page.getByRole('button', { name: 'New Character' }).click()
  await expect(page).toHaveURL(/\/party\?draft=/)
  const draft = new URL(page.url()).searchParams.get('draft')!
  const res = await page.request.post(`/api/campaigns/${campaign}/drafts/${draft}/save`, {
    data: { draft: fighterDraft(name), step: 'review' }
  })
  expect(res.status()).toBe(201)
}

let dm: FakeDm | undefined
test.afterEach(async () => {
  await dm?.kill()
  dm = undefined
})

test('a browser with no Claim takes a seat, Claims a Character and plays a turn', async ({
  page
}) => {
  const { id, folder } = await createCampaign(page, unique('Claims Test'))
  await addFighter(page, id, 'Wren')
  // The Host's Claim on Wren lapses, so this browser arrives holding nothing.
  const [wren] = (await (await page.request.get(`/api/campaigns/${id}/claims`)).json()) as {
    id: string
  }[]
  const letGo = await page.request.delete(`/api/campaigns/${id}/claims/${wren.id}`, {
    headers: { 'content-type': 'application/json' }
  })
  expect(await letGo.text()).toBe('')
  dm = await startFakeDm({ folder, home: E2E_HOME })

  await page.goto(`/campaigns/${id}/play`)
  await page.waitForLoadState('networkidle')
  await expect(page.getByText('DM at the table')).toBeVisible()

  const seat = page.getByRole('dialog', { name: 'Take a seat' })
  await expect(seat).toBeVisible()
  await expect(seat.getByRole('button', { name: 'Sit down' })).toBeDisabled()
  await expect(page.getByRole('main', { name: 'Play console' })).toHaveAttribute('inert')

  await seat.getByRole('button', { name: 'Claim' }).click()
  await expect(seat.getByRole('button', { name: 'Let go' })).toBeVisible()
  await seat.getByRole('button', { name: 'Sit down' }).click()
  await expect(seat).toBeHidden()

  dm.script({
    on: 'floor',
    run: async (event) => {
      expect(event.content).toBe('[d1 Wren · player] I pick the lock.')
      await dm!.call('seed')
      await dm!.call('narrate', { text: 'The lock clicks open.' })
    }
  })
  await page.getByRole('textbox', { name: 'What does Wren do?' }).fill('I pick the lock.')
  await page.getByRole('button', { name: 'Send' }).click()
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByText('The lock clicks open.')).toBeVisible()

  // Letting go of the last Claim brings the dialog back.
  await page.getByRole('button', { name: 'Your Characters' }).click()
  await seat.getByRole('button', { name: 'Let go' }).click()
  await expect(seat).toBeVisible()
  await expect(seat.getByRole('button', { name: 'Sit down' })).toBeDisabled()
})
