import { execFile } from 'node:child_process'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { fighterDraft } from '../lib/server/character/test-characters'
import { startFakeDm, type FakeDm } from '../testing/fake-dm'
import { E2E_HOME } from '../../playwright.config'

/** The committed hooks bundle, run with plain Node like Claude Code does. */
const HOOKS_BUNDLE = path.resolve(import.meta.dirname, '../../plugin/hooks/dm-hooks.mjs')

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

/** Saves a finished Fighter into the Party through the Party step's draft API; returns its id. */
async function addFighter(page: Page, campaign: string, name: string): Promise<string> {
  await page.goto(`/campaigns/${campaign}/party`)
  await page.getByRole('button', { name: 'New Character' }).click()
  await expect(page).toHaveURL(/\/party\?draft=/)
  const draft = new URL(page.url()).searchParams.get('draft')!
  const res = await page.request.post(`/api/campaigns/${campaign}/drafts/${draft}/save`, {
    data: { draft: fighterDraft(name), step: 'review' }
  })
  expect(res.status()).toBe(201)
  return ((await res.json()) as { id: string }).id
}

/** What the SessionStart hook injects when a Session opens in `folder`, as Claude Code runs it. */
function sessionStart(folder: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      process.execPath,
      [HOOKS_BUNDLE, 'session-start'],
      { env: { PATH: process.env.PATH, DUNGEON_MASTER_HOME: E2E_HOME } },
      (error, stdout) => {
        if (error) return reject(error)
        resolve(JSON.parse(stdout).hookSpecificOutput.additionalContext)
      }
    )
    child.stdin!.end(
      JSON.stringify({ cwd: folder, hook_event_name: 'SessionStart', source: 'startup' })
    )
  })
}

let dm: FakeDm | undefined
test.afterEach(async () => {
  await dm?.kill()
  dm = undefined
})

test('with the DM away, play waits and an offline edit reaches the next Session as a change notice', async ({
  page
}) => {
  const { id, folder } = await createCampaign(page, `Away Test ${Date.now()}`)
  const wren = await addFighter(page, id, 'Wren')
  await sessionStart(folder) // an earlier Session heard of Wren's arrival

  await page.goto(`/campaigns/${id}/play`)
  await page.waitForLoadState('networkidle')
  const away = page.getByRole('status', { name: 'DM away' })
  await expect(away).toContainText(`&& dm`)
  await expect(page.getByRole('button', { name: 'Send' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Done' })).toHaveCount(0)
  await page.getByRole('textbox', { name: 'What does Wren do?' }).fill('I pick the lock.')
  expect((await page.request.post(`/api/campaigns/${id}/floor/done`, { data: {} })).status()).toBe(
    409
  )

  const edit = await page.request.patch(`/api/campaigns/${id}/characters/${wren}`, {
    data: { notes: 'Owes Tam a favour.', appearance: 'A scar across one brow.' }
  })
  expect(edit.status()).toBe(200)

  const context = await sessionStart(folder)
  expect(context).toContain('Changed since last Session:')
  expect(context).toMatch(/^- char:wren v2: the Player edited Wren’s notes and appearance$/m)
  expect(await sessionStart(folder)).not.toContain('Changed since last Session')
})

test('a turn the DM left mid-way is answered after the recap at the next opening', async ({
  page
}) => {
  const { id, folder } = await createCampaign(page, `Dropped Test ${Date.now()}`)
  await addFighter(page, id, 'Wren')
  dm = await startFakeDm({ folder, home: E2E_HOME })
  await page.goto(`/campaigns/${id}/play`)
  await page.waitForLoadState('networkidle')
  await expect(page.getByText('DM at the table')).toBeVisible()

  // The DM hears the turn and leaves before narrating it.
  dm.script({ on: 'floor' })
  await page.getByRole('textbox', { name: 'What does Wren do?' }).fill('I pick the lock.')
  await page.getByRole('button', { name: 'Send' }).click()
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByRole('progressbar', { name: 'The DM is working' })).toBeVisible()
  await dm.settled()
  await dm.kill()
  dm = undefined

  await expect(page.getByText(/The DM left mid-turn/)).toBeVisible()
  await expect(page.getByRole('progressbar')).toHaveCount(0)

  // The next Session opens on a recap, then answers the turn.
  const context = await sessionStart(folder)
  expect(context).toContain('A turn awaits Narration')
  dm = await startFakeDm({ folder, home: E2E_HOME })
  await expect(page.getByText('DM at the table')).toBeVisible()
  await expect(page.getByRole('progressbar', { name: 'The DM is working' })).toBeVisible()
  await dm.call('narrate', {
    text: 'Last time, Wren knelt at the harbour office door.',
    recap: true
  })
  await expect(page.getByRole('progressbar', { name: 'The DM is working' })).toBeVisible()
  await dm.call('narrate', { text: 'The lock clicks open.' })

  const timeline = page.getByRole('list', { name: 'Timeline' })
  await expect(timeline.getByText('The lock clicks open.')).toBeVisible()
  await expect(page.getByRole('progressbar')).toHaveCount(0)
  await expect(page.getByText(/The DM left mid-turn/)).toHaveCount(0)
  await dm.close()
})
