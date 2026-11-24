import { expect, test, type Page } from '@playwright/test'
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

test('a play turn: a Declaration, Done, and the DM’s Narration', async ({ page }) => {
  const { id, folder } = await createCampaign(page, `Turn Test ${Date.now()}`)
  await addFighter(page, id, 'Wren')
  dm = await startFakeDm({ folder, home: E2E_HOME })
  await openConsole(page, id)

  let release = () => {}
  const held = new Promise<void>((r) => (release = r))
  dm.script({
    on: 'floor',
    run: async (event) => {
      expect(event.content).toBe('[d1 Wren · player] I pick the lock.')
      await dm!.call('seed')
      await held
      await dm!.call('narrate', { text: 'The lock clicks open.' })
    }
  })

  await page.getByRole('textbox', { name: 'What does Wren do?' }).fill('I pick the lock.')
  await page.getByRole('button', { name: 'Send' }).click()
  await page.getByRole('button', { name: 'Done' }).click()

  const timeline = page.getByRole('list', { name: 'Timeline' })
  await expect(timeline.getByRole('listitem').first()).toHaveText(/Wren\s*I pick the lock\./)
  await expect(page.getByRole('progressbar', { name: 'The DM is working' })).toBeVisible()
  await expect(page.getByText(/^\d+s \/ ~20s$/)).toBeVisible()
  await expect(timeline.getByText('⚙ DM checks the Campaign Seed')).toBeVisible()
  await expect(page.getByRole('list', { name: 'Pending Declarations' })).toHaveCount(0)

  release()
  await expect(timeline.getByText('The lock clicks open.')).toBeVisible()
  await expect(page.getByRole('progressbar')).toHaveCount(0)
  await dm.settled()

  const res = await page.request.get(`/api/campaigns/${id}/timeline`)
  expect(JSON.stringify(await res.json())).not.toContain('"handle"')
  await dm.close()
})

test('a two-Character Floor arrives as one event and gets one Narration', async ({ page }) => {
  const { id, folder } = await createCampaign(page, `Two Test ${Date.now()}`)
  await addFighter(page, id, 'Wren')
  await addFighter(page, id, 'Bram')
  dm = await startFakeDm({ folder, home: E2E_HOME })
  await openConsole(page, id)

  dm.script({
    on: 'floor',
    run: async (event) => {
      expect(event.content).toBe(
        '[d1 Wren · player] I pick the lock.\n[d2 Bram · player] I watch the street.'
      )
      const npc = await dm!.call('establish', { type: 'npc', name: 'Old Tam' })
      await dm!.call('narrate', {
        text: '"Quick now," Tam hisses as the lock gives.',
        voice: npc.payload.handle
      })
    }
  })

  await page.getByRole('textbox', { name: 'What does Wren do?' }).fill('I pick the lock.')
  await page.getByRole('button', { name: 'Send' }).click()
  await page.getByRole('tab', { name: 'Bram' }).click()
  await page.getByRole('textbox', { name: 'What does Bram do?' }).fill('I watch the street.')
  await page.keyboard.press('Control+Enter')

  const items = page.getByRole('list', { name: 'Timeline' }).getByRole('listitem')
  await expect(items).toHaveText([
    /Wren\s*I pick the lock\./,
    /Bram\s*I watch the street\./,
    /Old Tam\s*"Quick now," Tam hisses as the lock gives\./
  ])
  await dm.settled()
  await dm.close()
})

test('a Check Call: Declaration, Done, the roll clicked in the browser, and Narration', async ({
  page
}) => {
  const { id, folder } = await createCampaign(page, `Call Test ${Date.now()}`)
  await addFighter(page, id, 'Wren')
  dm = await startFakeDm({ folder, home: E2E_HOME })
  await openConsole(page, id)

  dm.script(
    {
      on: 'floor',
      run: async () => {
        const opened = await dm!.call('narrate', {
          text: 'The lock is old and rusted.',
          call: {
            kind: 'check',
            character: 'Wren',
            skill: 'sleight-of-hand',
            tier: 'hard',
            reason: 'The lock is old and stiff'
          }
        })
        expect(opened.isError).toBe(false)
      }
    },
    {
      on: 'call_result',
      run: async (event) => {
        expect(event.content).toMatch(
          /^\[Wren · player\] Sleight of Hand check: d20 \d+ [+-] \d+ = \d+ vs DC 20 \(hard\) → (success|failure)$/
        )
        await dm!.call('narrate', { text: 'The tumblers fall into place.' })
      }
    }
  )

  await page.getByRole('textbox', { name: 'What does Wren do?' }).fill('I pick the lock.')
  await page.getByRole('button', { name: 'Send' }).click()
  await page.getByRole('button', { name: 'Done' }).click()

  const card = page.getByRole('region', { name: 'Call' })
  await expect(card.getByText('Sleight of Hand check')).toBeVisible()
  await expect(card.getByText('The lock is old and stiff')).toBeVisible()
  await expect(card).not.toContainText(/DC|20|hard/)

  await page.reload()
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Roll Sleight of Hand check for Wren' }).click()

  const timeline = page.getByRole('list', { name: 'Timeline' })
  await expect(timeline.getByText(/Sleight of Hand check/)).toBeVisible()
  await expect(timeline.getByText('The tumblers fall into place.')).toBeVisible()
  await expect(card).toHaveCount(0)
  await dm.settled()

  const res = await page.request.get(`/api/campaigns/${id}/timeline`)
  expect(JSON.stringify(await res.json())).not.toMatch(/"dc"|"tier"|"hard"/)
  await dm.close()
})

test('an attack: the DM attacks with Wren, the Player rolls to hit and damage, and the DM hears one result', async ({
  page
}) => {
  const { id, folder } = await createCampaign(page, `Attack Test ${Date.now()}`)
  await addFighter(page, id, 'Wren')
  dm = await startFakeDm({ folder, home: E2E_HOME })
  await openConsole(page, id)

  dm.script(
    {
      on: 'floor',
      run: async () => {
        const goblin = await dm!.call('establish', {
          type: 'npc',
          name: 'Grik',
          fields: { stat_block: 'monster:goblin' }
        })
        const attack = await dm!.call('attack', {
          actor: 'char:wren',
          target: goblin.payload.handle,
          with: 'crossbow'
        })
        expect(attack.isError).toBe(false)
        const opened = await dm!.call('narrate', {
          text: 'Wren levels her crossbow at the goblin.',
          call: attack.payload.pending_call
        })
        expect(opened.isError).toBe(false)
      }
    },
    {
      on: 'call_result',
      run: async (event) => {
        expect(event.content).toMatch(
          /^\[Wren · player\] Crossbow, light attack on Grik \(npc:[^)]+\): d20 \d+ \+ 4 = \d+ vs AC 15 → (hit|critical hit|miss)/
        )
        await dm!.call('narrate', { text: 'The bolt flies.' })
      }
    }
  )

  await page.getByRole('textbox', { name: 'What does Wren do?' }).fill('I shoot the goblin.')
  await page.getByRole('button', { name: 'Send' }).click()
  await page.getByRole('button', { name: 'Done' }).click()

  const card = page.getByRole('region', { name: 'Call' })
  await expect(card.getByText('Crossbow, light attack')).toBeVisible()
  await expect(card).not.toContainText(/AC|15/)
  await page.getByRole('button', { name: 'Roll to hit for Wren' }).click()

  const timeline = page.getByRole('list', { name: 'Timeline' })
  const narrated = timeline.getByText('The bolt flies.')
  const damage = page.getByRole('button', { name: 'Roll damage for Wren' })
  await expect(narrated.or(damage)).toBeVisible()
  if (await damage.isVisible()) {
    await damage.click()
    await expect(timeline.getByText('Crossbow, light damage')).toBeVisible()
  }
  await expect(narrated).toBeVisible()
  await expect(timeline.getByText(/Crossbow, light attack/)).toBeVisible()
  await expect(card).toHaveCount(0)
  await dm.settled()

  const res = await page.request.get(`/api/campaigns/${id}/timeline`)
  expect(JSON.stringify(await res.json())).not.toMatch(/\bAC\b|"hp"|\/7\b/)
  await dm.close()
})
