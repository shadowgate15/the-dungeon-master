import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { seedCharacter } from './character-helpers'
import { createWorld } from './world-helpers'

const FAKE_LM_STUDIO = 'http://127.0.0.1:1235'

// The fake's answer queue is process-wide state: these tests must not overlap.
test.describe.configure({ mode: 'serial' })

async function script(request: APIRequestContext, answers: unknown[]) {
  const response = await request.post(`${FAKE_LM_STUDIO}/__control/answers`, {
    data: { answers, replace: true }
  })
  expect(response.ok()).toBe(true)
}

/** The system and chat messages the model received for the latest DM call. */
async function lastModelRequest(request: APIRequestContext) {
  const all = (await (await request.get(`${FAKE_LM_STUDIO}/__control/requests`)).json()) as {
    path: string
    body: { messages: { role: string; content: string }[] }
  }[]
  // The silent memory extraction call after each DM turn is not a DM call.
  return all
    .filter((r) => r.path === '/v1/chat/completions')
    .filter((r) => !JSON.stringify(r.body.messages).includes('MEMORY EXTRACTION'))
    .at(-1)!.body.messages
}

/** Creates a World, a Character and a Campaign, links them and starts a Session. */
async function startSession(page: Page, request: APIRequestContext, opening: string) {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`
  const world = `Turnworld ${stamp}`
  const campaign = `Turns ${stamp}`
  const hero = `Brenna ${stamp}`
  await createWorld(page, world)
  await seedCharacter(page, hero)
  await page.goto('/campaigns')
  await page.waitForLoadState('networkidle')
  await page.getByRole('link', { name: 'New Campaign' }).click()
  const dialog = page.getByRole('dialog', { name: 'New Campaign' })
  await dialog.getByLabel('Add World').selectOption({ label: world })
  await dialog.getByLabel('Name', { exact: true }).fill(campaign)
  await dialog.getByLabel('Premise', { exact: true }).fill('Escort a relic across the ash plains.')
  await dialog.getByLabel('Tone', { exact: true }).selectOption('tense')
  await dialog.getByLabel('Length', { exact: true }).selectOption('short')
  await dialog.getByRole('button', { name: 'Create Campaign' }).click()
  await expect(dialog).toBeHidden()
  await page
    .getByRole('row')
    .filter({ hasText: campaign })
    .getByRole('link', { name: 'Play' })
    .click()
  await page.waitForLoadState('networkidle')
  await page.locator('select[name=characterId]').selectOption({ label: hero })
  await page.getByRole('button', { name: 'Link Character' }).click()
  await expect(page.getByText(`Playing as ${hero}.`)).toBeVisible()

  await script(request, [{ content: opening }])
  await page.getByRole('button', { name: 'Start Session' }).click()
  await expect(page.getByRole('heading', { name: 'Session 1' })).toBeVisible()
  // The opening streams after the redirect: let it land before the test scripts anything else.
  await expect(transcript(page)).toContainText(opening)
  await expect(page.getByLabel('Your action')).toBeVisible()
  return { hero, world, campaign }
}

const transcript = (page: Page) => page.getByRole('list', { name: 'Transcript' })
const act = async (page: Page, text: string) => {
  await page.getByLabel('Your action').fill(text)
  await page.getByRole('button', { name: 'Send' }).click()
}

test('the DM opens the Session and answers each action, saved across a reload', async ({
  page,
  request
}) => {
  const { hero, world } = await startSession(page, request, 'A gate looms in the ash.')
  await expect(transcript(page)).toContainText('A gate looms in the ash.')
  await expect(page.getByLabel('Your action')).toBeVisible()

  await script(request, [{ content: 'The hinges scream as it opens.' }])
  await act(page, 'I push the gate.')
  await expect(transcript(page)).toContainText('The hinges scream as it opens.')

  // What the model was sent: the Seed, the World, the derived sheet and the plain-text history.
  const sent = await lastModelRequest(request)
  const system = sent
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n')
  expect(system).toContain('Escort a relic across the ash plains.')
  expect(system).toContain(world)
  expect(system).toContain(hero)
  expect(system).toContain('STR 16 (+3)')
  expect(sent.filter((m) => m.role !== 'system').map((m) => [m.role, m.content])).toEqual([
    ['assistant', 'A gate looms in the ash.'],
    ['user', 'I push the gate.']
  ])

  // Saved: the same transcript after a reload, in order.
  await page.reload()
  const items = transcript(page).getByRole('listitem')
  await expect(items).toHaveCount(3)
  await expect(items.nth(0)).toContainText('A gate looms in the ash.')
  await expect(items.nth(1)).toContainText('I push the gate.')
  await expect(items.nth(2)).toContainText('The hinges scream as it opens.')
})

test('Stop discards the partial DM turn, keeps the action, and Retry answers it', async ({
  page,
  request
}) => {
  await startSession(page, request, 'A gate looms.')

  await script(request, [{ content: 'You will never see this.', delayMs: 10_000 }])
  await act(page, 'I wait.')
  await expect(page.getByRole('button', { name: 'End Session' })).toBeDisabled()
  await page.getByRole('button', { name: 'Stop' }).click()

  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible()
  await expect(transcript(page)).toContainText('I wait.')
  await expect(transcript(page)).not.toContainText('You will never see this.')

  await script(request, [{ content: 'Nothing stirs.' }])
  await page.getByRole('button', { name: 'Retry' }).click()
  await expect(transcript(page)).toContainText('Nothing stirs.')
  await expect(transcript(page).getByText('I wait.')).toHaveCount(1) // not saved twice
  await expect(page.getByLabel('Your action')).toBeVisible()
})

test('a model failure shows an error and Retry; the action is kept', async ({ page, request }) => {
  await startSession(page, request, 'A gate looms.')

  await script(request, [{ status: 500, times: 3 }])
  await act(page, 'I knock.')
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible()
  await expect(transcript(page)).toContainText('I knock.')

  await script(request, [{ content: 'Someone answers.' }])
  await page.getByRole('button', { name: 'Retry' }).click()
  await expect(transcript(page)).toContainText('Someone answers.')
})

test('a failed opening can be retried', async ({ page, request }) => {
  const stamp = Date.now()
  await createWorld(page, `Openworld ${stamp}`)
  await seedCharacter(page, `Hero ${stamp}`)
  await page.goto('/campaigns')
  await page.waitForLoadState('networkidle')
  await page.getByRole('link', { name: 'New Campaign' }).click()
  const dialog = page.getByRole('dialog', { name: 'New Campaign' })
  await dialog.getByLabel('Add World').selectOption({ label: `Openworld ${stamp}` })
  await dialog.getByLabel('Name', { exact: true }).fill(`Open ${stamp}`)
  await dialog.getByLabel('Premise', { exact: true }).fill('A premise.')
  await dialog.getByLabel('Tone', { exact: true }).selectOption('tense')
  await dialog.getByLabel('Length', { exact: true }).selectOption('short')
  await dialog.getByRole('button', { name: 'Create Campaign' }).click()
  await expect(dialog).toBeHidden()
  await page
    .getByRole('row')
    .filter({ hasText: `Open ${stamp}` })
    .getByRole('link', { name: 'Play' })
    .click()
  await page.waitForLoadState('networkidle')
  await page.locator('select[name=characterId]').selectOption({ label: `Hero ${stamp}` })
  await page.getByRole('button', { name: 'Link Character' }).click()
  await expect(page.getByText(`Playing as Hero ${stamp}.`)).toBeVisible()

  await script(request, [{ status: 500, times: 3 }])
  await page.getByRole('button', { name: 'Start Session' }).click()
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible()

  // Reloading never re-asks the model on its own.
  await page.reload()
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible()
  await script(request, [{ content: 'Dawn breaks.' }])
  await page.getByRole('button', { name: 'Retry' }).click()
  await expect(transcript(page)).toContainText('Dawn breaks.')
})

test('a closed tab discards the reply like Stop, and a second call is refused meanwhile', async ({
  page,
  request,
  browser
}) => {
  await startSession(page, request, 'A gate looms.')
  const url = page.url().split('?')[0]
  const turnApi = `${url.replace(/\/campaigns\/.*/, '')}/api/sessions/${url.split('/').pop()}/turn`

  await script(request, [{ content: 'Never saved.', delayMs: 10_000 }])
  await act(page, 'I linger.')
  await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible()

  // One call in flight per Session: a second is refused.
  const refused = await request.post(turnApi, { data: { forwardedProps: { action: 'Again' } } })
  expect(refused.status()).toBe(409)

  await page.close()

  const fresh = await (await browser.newContext()).newPage()
  await fresh.goto(url)
  await expect(fresh.getByRole('button', { name: 'Retry' })).toBeVisible()
  await expect(transcript(fresh)).toContainText('I linger.')
  await expect(transcript(fresh)).not.toContainText('Never saved.')
  await expect(transcript(fresh).getByText('Again')).toHaveCount(0)

  // The closed tab released the Session: Retry is accepted and answered.
  await script(request, [{ content: 'The dust settles.' }])
  await fresh.getByRole('button', { name: 'Retry' }).click()
  await expect(transcript(fresh)).toContainText('The dust settles.')
})

test('an NPC introduced in one DM turn is in the next turn model request', async ({
  page,
  request
}) => {
  const extractions = async () =>
    (
      (await (await request.get(`${FAKE_LM_STUDIO}/__control/requests`)).json()) as {
        body?: { messages: { content: string }[] }
      }[]
    ).filter((r) => JSON.stringify(r.body?.messages ?? []).includes('MEMORY EXTRACTION')).length

  await request.post(`${FAKE_LM_STUDIO}/__control/extractions`, {
    data: {
      replace: true,
      answers: [
        {
          content: {
            npcs: [
              {
                name: 'Vessa Thorn',
                description: 'A one-eyed relic broker.',
                role: 'broker',
                status: 'alive',
                stance: 'friendly'
              }
            ],
            facts: []
          }
        }
      ]
    }
  })
  const before = await extractions()
  await startSession(page, request, 'Vessa Thorn, a relic broker, beckons you.')
  // Extraction runs after the saved turn and never blocks play; let it land.
  await expect.poll(extractions).toBeGreaterThan(before)
  await page.waitForTimeout(500)

  await script(request, [{ content: 'Vessa smiles.' }])
  await act(page, 'I greet her.')
  await expect(transcript(page)).toContainText('Vessa smiles.')
  const messages = await lastModelRequest(request)
  const system = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n')
  expect(system).toContain('Vessa Thorn (alive, friendly toward you), broker')
})
