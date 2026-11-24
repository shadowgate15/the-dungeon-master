import { expect, test, type Page } from '@playwright/test'
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

let dm: FakeDm | undefined
test.afterEach(async () => {
  await dm?.kill()
  dm = undefined
})

test('with no DM the pane says the forms work and how to start one', async ({ page }) => {
  const { folder } = await createCampaign(page, `Away Test ${Date.now()}`)
  const pane = page.getByRole('region', { name: 'Ask the DM' })
  await expect(pane).toContainText('The forms work without the DM')
  await expect(pane.getByText(`cd ${folder} && dm`)).toBeVisible()
  await expect(pane.getByRole('textbox', { name: 'Message to the DM' })).toBeDisabled()

  // Docked on the right at full height.
  await page.setViewportSize({ width: 1440, height: 900 })
  const box = (await page.getByTestId('dm-pane').boundingBox())!
  expect(box.x + box.width).toBeCloseTo(1440, 0)
  expect(box.y + box.height).toBeCloseTo(900, 0)
})

test('the DM answers in the pane and fills a Seed field, marked ✎ DM', async ({ page }) => {
  const { id, folder } = await createCampaign(page, `Help Test ${Date.now()}`)
  dm = await startFakeDm({ folder, home: E2E_HOME })
  await expect
    .poll(async () => (await (await page.request.get('/api/sessions')).json()).attached)
    .toContain(id)
  await page.reload()
  await page.waitForLoadState('networkidle')
  await expect(page.getByText('DM at the table')).toBeVisible()

  dm.script({
    on: 'conversation',
    run: async (event) => {
      expect(event.content).toBe('Give me a premise?')
      const { version } = (await dm!.call('seed')).payload
      const set = await dm!.call('set_seed', {
        version,
        premise: 'Escort a relic across the burning hills.'
      })
      expect(set.isError).toBe(false)
      await dm!.call('reply', { text: 'How about an escort through the burning hills?' })
    }
  })

  const pane = page.getByRole('region', { name: 'Ask the DM' })
  await pane.getByRole('textbox', { name: 'Message to the DM' }).fill('Give me a premise?')
  await pane.getByRole('button', { name: 'Send' }).click()

  const log = pane.getByRole('list', { name: 'Conversation' })
  await expect(log).toContainText('Give me a premise?')
  await expect(log).toContainText('How about an escort through the burning hills?')
  await expect(log).toContainText('✎ DM set the Seed’s premise')
  await expect(page.getByLabel('Premise')).toHaveValue('Escort a relic across the burning hills.')
  const marks = page.getByRole('main').getByText('✎ DM', { exact: true })
  await expect(marks).toHaveCount(1)
  await dm.settled()

  // Editing the field makes it the Player's: the mark goes.
  await page.getByLabel('Premise').fill('My own premise.')
  await expect(marks).toHaveCount(0)

  // Nothing from the creation conversation is part of the story.
  const res = await page.request.get(`/api/campaigns/${id}/timeline`)
  const entries = (await res.json()).entries as { type: string }[]
  expect(entries.filter((e) => e.type !== 'activity')).toEqual([])
  await dm.close()
})

test('the DM fills a draft field in the open wizard, marked ✎ DM', async ({ page }) => {
  const { id, folder } = await createCampaign(page, `Draft Help ${Date.now()}`)
  await page.goto(`/campaigns/${id}/party`)
  await page.getByRole('button', { name: 'New Character' }).click()
  await expect(page).toHaveURL(/\/party\?draft=/)
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Name', { exact: true }).fill('Wren')
  await expect(page.getByText('Draft saved')).toBeVisible()

  dm = await startFakeDm({ folder, home: E2E_HOME })
  await expect(page.getByText('DM at the table')).toBeVisible({ timeout: 10_000 })

  dm.script({
    on: 'conversation',
    run: async () => {
      const state = (await dm!.call('creation_state')).payload as {
        drafts: { handle: string; version: number }[]
      }
      const [{ handle, version }] = state.drafts
      const set = await dm!.call('set_draft_fields', {
        draft: handle,
        version,
        fields: { backstory: 'Raised by the lighthouse keeper.' }
      })
      expect(set.isError).toBe(false)
      await dm!.call('reply', { text: 'I gave Wren a backstory.' })
    }
  })

  const pane = page.getByRole('region', { name: 'Ask the DM' })
  await pane.getByRole('textbox', { name: 'Message to the DM' }).fill('A backstory for Wren?')
  await pane.getByRole('button', { name: 'Send' }).click()

  await expect(pane.getByRole('list', { name: 'Conversation' })).toContainText(
    '✎ DM set Wren’s backstory'
  )
  await expect(page.getByLabel('Backstory')).toHaveValue('Raised by the lighthouse keeper.')
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Wren')
  await expect(page.getByRole('main').getByText('✎ DM', { exact: true })).toHaveCount(1)
  await dm.settled()
  await dm.close()
})
