import { expect, test, type Page } from '@playwright/test'
import { unique } from '../testing/unique'
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

/** Opens the play console with the DM at the table. */
async function openConsole(page: Page, campaign: string) {
  await page.goto(`/campaigns/${campaign}/play`)
  await page.waitForLoadState('networkidle')
  await expect(page.getByText('DM at the table')).toBeVisible()
}

let dm: FakeDm | undefined
test.afterEach(async () => {
  await dm?.kill()
  dm = undefined
})

const request = {
  request_id: 'abcde',
  tool_name: 'Bash',
  description: 'List the Campaign folder',
  input_preview: 'ls -la'
}

test('a permission prompt is relayed to the browser and approved', async ({ page }) => {
  const { id, folder } = await createCampaign(page, unique('Permission Test'))
  dm = await startFakeDm({ folder, home: E2E_HOME })
  await openConsole(page, id)

  await dm.requestPermission(request)
  const card = page.getByRole('group', { name: 'Permission request' })
  await expect(card).toContainText('Bash')
  await expect(card).toContainText('List the Campaign folder')
  await expect(card).toContainText('ls -la')
  await expect(page.getByRole('dialog')).toHaveCount(0)

  const verdict = dm.permissionVerdict('abcde')
  await card.getByRole('button', { name: 'Allow' }).click()
  expect(await verdict).toBe('allow')
  await expect(card).toHaveCount(0)
  await dm.close()
})

test('a reload still shows the open prompt, and Deny answers it', async ({ page }) => {
  const { id, folder } = await createCampaign(page, unique('Deny Test'))
  dm = await startFakeDm({ folder, home: E2E_HOME })
  await openConsole(page, id)

  await dm.requestPermission(request)
  const card = page.getByRole('group', { name: 'Permission request' })
  await expect(card).toBeVisible()
  await page.reload()
  await expect(card).toContainText('Bash')

  const verdict = dm.permissionVerdict('abcde')
  await card.getByRole('button', { name: 'Deny' }).click()
  expect(await verdict).toBe('deny')
  await expect(card).toHaveCount(0)
  await dm.close()
})

test('the card clears when the prompt is answered in the terminal', async ({ page }) => {
  const { id, folder } = await createCampaign(page, unique('Terminal Test'))
  dm = await startFakeDm({ folder, home: E2E_HOME })
  await openConsole(page, id)

  await dm.requestPermission(request)
  const card = page.getByRole('group', { name: 'Permission request' })
  await expect(card).toBeVisible()
  // Answered in the terminal: Claude Code says nothing, but the session moves on.
  await dm.call('seed')
  await expect(card).toHaveCount(0)
  await dm.close()
})
