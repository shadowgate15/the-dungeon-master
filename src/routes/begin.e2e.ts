import { expect, test } from '@playwright/test'
import { unique } from '../testing/unique'
import { startFakeDm, type FakeDm } from '../testing/fake-dm'
import { saveFighter } from '../testing/wizard-e2e'
import { E2E_HOME } from '../../playwright.config'

let dm: FakeDm | undefined
test.afterEach(async () => {
  await dm?.kill()
  dm = undefined
})

test('creation offline (Seed → Party), then Begin with a live DM shows only the pitch', async ({
  page
}) => {
  const name = unique('Begin Road')
  await page.goto('/campaigns')
  await page.waitForLoadState('networkidle')
  await page.getByRole('link', { name: 'New Campaign' }).click()
  const dialog = page.getByRole('dialog', { name: 'New Campaign' })
  await dialog.getByLabel('Name', { exact: true }).fill(name)
  const folder = await dialog.getByLabel('Folder').inputValue()
  await dialog.getByRole('button', { name: 'Create Campaign' }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  const id = page.url().split('/').at(-1)!
  const stepper = page.getByRole('navigation', { name: 'Campaign creation' })

  // Begin is disabled until the Seed is complete and a Character is saved.
  await stepper.getByRole('link', { name: /Begin/ }).click()
  await expect(page.getByRole('button', { name: 'Begin' })).toBeDisabled()

  // The Seed, offline.
  await stepper.getByRole('link', { name: /Seed/ }).click()
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Premise').fill('Escort a relic across the burning hills.')
  await page.getByLabel('Tone').selectOption('heroic')
  await page.getByLabel('Length').selectOption('short')
  await page.getByRole('button', { name: 'Save Seed' }).click()
  await expect(page.getByText('Saved', { exact: true })).toBeVisible()

  // The Party, offline.
  await stepper.getByRole('link', { name: /Party/ }).click()
  await expect(page.getByText('No Characters yet.')).toBeVisible()
  await saveFighter(page)

  // Ready, but the DM is away.
  await stepper.getByRole('link', { name: /Begin/ }).click()
  await page.waitForLoadState('networkidle')
  await expect(page.getByText('The DM is away')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Begin' })).toBeDisabled()

  dm = await startFakeDm({ folder, home: E2E_HOME })
  await expect(page.getByText('DM at the table')).toBeVisible({ timeout: 10_000 })
  const begin = page.getByRole('button', { name: 'Begin' })
  await expect(begin).toBeEnabled()

  dm.script({
    on: 'begin',
    run: async () => {
      const state = (await dm!.call('creation_state')).payload
      expect(state.state).toBe('begun')
      const established = await dm!.call('establish', {
        type: 'npc',
        name: 'Vizier Oren',
        fields: {},
        facts: [{ claim: 'Vizier Oren secretly leads the Ashen Cult.' }]
      })
      expect(established.isError).toBe(false)
      const pitch = await dm!.call('reveal', {
        claim: 'Vizier Oren hired you to carry a relic across the burning hills.',
        about: 'npc:vizier-oren',
        holders: ['char:brannoch'],
        source: 'the job'
      })
      expect(pitch.isError).toBe(false)
      const arc = await dm!.call('create_arc', {
        title: 'The Secret Patron',
        premise: 'The Ashen Cult wants the relic.',
        stakes: 'The hills burn for a generation.',
        acts: [
          {
            name: 'The Road Out',
            purpose: 'Leave Ashford.',
            beats: [{ title: 'Ambush at the Ford', description: 'The cult strikes first.' }]
          }
        ],
        resolution: 'The relic is sealed.'
      })
      expect(arc.isError).toBe(false)
    }
  })
  await begin.click()

  // The pitch, as the Characters' Beliefs.
  const pitch = page.getByRole('region', { name: 'The pitch' })
  await expect(pitch).toContainText('Vizier Oren hired you to carry a relic')
  await dm.settled()
  await expect(page.getByRole('button', { name: 'Start over' })).toBeVisible()

  // The Seed is read-only now.
  await stepper.getByRole('link', { name: /Seed/ }).click()
  await expect(page.getByLabel('Premise')).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Save Seed' })).toHaveCount(0)

  // Play opens with the first Narration; Start over is gone.
  await dm.call('narrate', { text: 'Ashford’s gate creaks open onto the burning hills.' })
  await stepper.getByRole('link', { name: /Begin/ }).click()
  await expect(page.getByRole('link', { name: /Play has opened/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start over' })).toHaveCount(0)

  // No Arc content reaches the Player anywhere.
  for (const path of ['timeline', 'journal', 'scene']) {
    const body = await (await page.request.get(`/api/campaigns/${id}/${path}`)).text()
    expect(body).not.toMatch(/Secret Patron|Ambush at the Ford|Ashen Cult/)
  }
  await page.goto(`/campaigns/${id}/play`)
  await expect(page.getByText('Ashford’s gate creaks open')).toBeVisible()
  await expect(page.locator('body')).not.toContainText(
    /Secret Patron|Ambush at the Ford|Ashen Cult/
  )
  await dm.close()
})
