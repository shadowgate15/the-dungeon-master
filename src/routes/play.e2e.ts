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

test('Declarations wait in the pending tray, editable and withdrawable, across a reload', async ({
  page
}) => {
  const { id: campaign, folder } = await createCampaign(page, unique('Tray Test'))
  await addFighter(page, campaign, 'Wren')
  await addFighter(page, campaign, 'Bram')
  dm = await startFakeDm({ folder, home: E2E_HOME })

  await page.goto(`/campaigns/${campaign}/play`)
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('tabpanel', { name: 'Wren' })).toBeVisible()

  await page.getByRole('textbox', { name: 'What does Wren do?' }).fill('I pick the lock.')
  await page.getByRole('button', { name: 'Send' }).click()
  await page.getByRole('tab', { name: 'Bram' }).click()
  await page.getByRole('textbox', { name: 'What does Bram do?' }).fill('I watch the street.')
  await page.getByRole('button', { name: 'Send' }).click()

  const tray = page.getByRole('list', { name: 'Pending Declarations' })
  await expect(tray.getByRole('listitem')).toHaveText([
    /Wren\s*I pick the lock\./,
    /Bram\s*I watch the street\./
  ])

  await page.getByRole('button', { name: 'Edit Wren: I pick the lock.' }).click()
  await page.getByRole('textbox', { name: 'Edit Declaration' }).fill('I pick the lock quietly.')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByRole('button', { name: 'Withdraw Bram: I watch the street.' }).click()
  await expect(tray.getByRole('listitem')).toHaveText([/Wren\s*I pick the lock quietly\./])

  await page.reload()
  await expect(tray.getByRole('listitem')).toHaveText([/Wren\s*I pick the lock quietly\./])
})

test('the console is bound to the viewport and the composer stays pinned', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  const { id: campaign, folder } = await createCampaign(page, unique('Viewport Test'))
  await addFighter(page, campaign, 'Wren')
  dm = await startFakeDm({ folder, home: E2E_HOME })

  await page.goto(`/campaigns/${campaign}/play`)
  await page.waitForLoadState('networkidle')
  const box = page.getByRole('textbox', { name: 'What does Wren do?' })
  for (let i = 0; i < 12; i++) {
    await box.fill(`Step ${i}: I keep walking down the long corridor, looking for traps.`)
    await page.getByRole('button', { name: 'Send' }).click()
  }
  await expect(
    page.getByRole('list', { name: 'Pending Declarations' }).getByRole('listitem')
  ).toHaveCount(12)

  const scroll = await page.evaluate(() => ({
    page: document.scrollingElement!.scrollHeight,
    viewport: window.innerHeight
  }))
  expect(scroll.page).toBeLessThanOrEqual(scroll.viewport)
  const composer = await box.boundingBox()
  expect(composer!.y + composer!.height).toBeLessThanOrEqual(720)
})

test('the Scene rail is bound to the viewport and its cards scroll inside', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  const { id: campaign, folder } = await createCampaign(page, unique('Rail Test'))
  await addFighter(page, campaign, 'Wren')
  dm = await startFakeDm({ folder, home: E2E_HOME })

  const villagers = [
    'Aldous',
    'Brina',
    'Corwin',
    'Dagny',
    'Elric',
    'Fenna',
    'Gorm',
    'Hester',
    'Ivo',
    'Jessamy',
    'Kestrel',
    'Lorcan',
    'Maud',
    'Nyle'
  ]
  dm.script({
    on: 'floor',
    run: async () => {
      for (const name of villagers) {
        const npc = await dm!.call('establish', { type: 'npc', name })
        expect(npc.isError).toBe(false)
        await dm!.call('reveal', { of: npc.payload.handle, holders: ['char:wren'] })
      }
      const combat = await dm!.call('start_combat', {
        combatants: [{ monster: 'monster:goblin', count: 20 }]
      })
      expect(combat.isError).toBe(false)
      await dm!.call('narrate', {
        text: 'Goblins pour out of every doorway.',
        call: combat.payload.pending_call
      })
    }
  })

  await page.goto(`/campaigns/${campaign}/play`)
  await page.waitForLoadState('networkidle')
  await page.getByRole('textbox', { name: 'What does Wren do?' }).fill('I ask around.')
  await page.getByRole('button', { name: 'Send' }).click()
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByText('Goblins pour out of every doorway.')).toBeVisible()
  await dm.settled()

  const rail = page.getByRole('complementary', { name: 'Scene' })
  const initiative = rail.getByRole('region', { name: 'Initiative' })
  const knows = rail.getByRole('region', { name: /^What .* knows$/ })
  await expect(initiative.getByRole('listitem')).toHaveCount(20)
  await expect(knows.getByRole('region', { name: 'Nyle' })).toBeAttached()

  const railBox = await rail.boundingBox()
  expect(railBox!.y + railBox!.height).toBeLessThanOrEqual(720)

  for (const card of [initiative, knows]) {
    const cardBox = await card.boundingBox()
    expect(cardBox!.y + cardBox!.height).toBeLessThanOrEqual(railBox!.y + railBox!.height + 1)
    const body = card.getByTestId('rail-card-body')
    const overflow = await body.evaluate((el) => el.scrollHeight - el.clientHeight)
    expect(overflow).toBeGreaterThan(0)
    // The header stays put while the body scrolls.
    const header = card.getByRole('heading', { level: 2 })
    const before = await header.boundingBox()
    await body.evaluate((el) => (el.scrollTop = el.scrollHeight))
    expect(await header.boundingBox()).toEqual(before)
    await expect(header).toBeInViewport()
  }
})
