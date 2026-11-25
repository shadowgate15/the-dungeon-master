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

const summary = 'Wren picked the lock of the harbour office and found the ledger.'

test('End Session closes the Session, and the next one opens on a recap', async ({ page }) => {
  const { id, folder } = await createCampaign(page, unique('Session Test'))
  await addFighter(page, id, 'Wren')

  // The first Session: a Narration, then End Session.
  dm = await startFakeDm({ folder, home: E2E_HOME })
  await page.goto(`/campaigns/${id}/play`)
  await page.waitForLoadState('networkidle')
  await expect(page.getByText('DM at the table')).toBeVisible()
  await dm.call('narrate', { text: 'The lock clicks open.' })
  dm.script({
    on: 'end_session',
    run: async () => {
      await dm!.call('narrate', { text: 'The harbour bell tolls midnight.' })
      const closed = await dm!.call('close_session', {
        summary,
        threads: ['Who signed the ledger?']
      })
      expect(closed.payload).toMatchObject({ session: 1, summarised: true })
    }
  })
  await page.getByRole('button', { name: 'End Session' }).click()
  await dm.settled()
  await dm.close()
  dm = undefined
  await expect(page.getByText('DM away')).toBeVisible()

  // The next Session: the DM reads the summary and recaps.
  dm = await startFakeDm({ folder, home: E2E_HOME })
  await expect(page.getByText('DM at the table')).toBeVisible()
  const recall = await dm.call('sessions', { last: 2 })
  expect(recall.payload).toMatchObject({
    current: 2,
    unclosed: [],
    recap_due: true,
    sessions: [{ number: 1, summary }]
  })
  await dm.call('narrate', { text: 'Last time, the ledger came to light.', recap: true })

  const recap = page.getByRole('list', { name: 'Timeline' }).getByRole('listitem').last()
  await expect(recap).toHaveText(/Previously\s*Last time, the ledger came to light\./)
  await dm.close()
  dm = undefined

  await page.getByRole('link', { name: 'Journal and Session history' }).click()
  const history = page.getByRole('article', { name: 'Session 1' })
  await expect(history).toContainText(summary)
  await expect(history).toContainText('Who signed the ledger?')
  await expect(page.getByRole('article', { name: 'Session 2' })).toHaveCount(0)
})
