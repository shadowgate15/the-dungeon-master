import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { seedCharacter } from './character-helpers'
import { acceptArc, queueFirstScene } from './session-helpers'
import { createWorld } from './world-helpers'

const FAKE_LM_STUDIO = 'http://127.0.0.1:1235'

// The fake's answer queue is process-wide state: this file must not overlap with others.
test.describe.configure({ mode: 'serial' })

/** An Adjudication of happens, in the flat wire shape (the unused fields hold their sentinels). */
const HAPPENS = { outcome: 'happens', skill: 'none', difficulty: 'none', question: '', choices: [] }

/**
 * Scripts the model's answers in order. An Exchange asks for its Adjudication, then its Effect
 * (both structured), then streams the Reply as prose; a move to a new place first generates it.
 */
async function script(request: APIRequestContext, answers: unknown[]) {
  const response = await request.post(`${FAKE_LM_STUDIO}/__control/answers`, {
    data: { answers: answers.map((content) => ({ content })), replace: true }
  })
  expect(response.ok()).toBe(true)
}

/**
 * The row id of an NPC in the Scene. The UI never shows it, so it is read from the last Effect
 * schema the model was sent, where the NPC ids are the `npcId` enum.
 */
async function npcId(request: APIRequestContext): Promise<string> {
  const sent = (await (await request.get(`${FAKE_LM_STUDIO}/__control/requests`)).json()) as {
    body: { response_format?: { json_schema?: { schema?: unknown } } }
  }[]
  const schemas = sent.map((r) => r.body?.response_format?.json_schema?.schema)
  const effect = schemas.findLast(
    (s) => (s as { properties?: { npcId?: unknown } } | undefined)?.properties?.npcId
  ) as { properties: { npcId: { enum: string[] } } } | undefined
  if (!effect) throw new Error('No Effect schema with NPC ids was sent')
  return effect.properties.npcId.enum[0]
}

/** Creates a World, a Character and a Campaign, links them and starts a Session. */
async function startSession(page: Page, request: APIRequestContext) {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`
  const world = `Tavernworld ${stamp}`
  const campaign = `Tavern ${stamp}`
  const hero = `Brenna ${stamp}`
  await createWorld(page, world)
  await seedCharacter(page, hero)
  await page.goto('/campaigns')
  await page.waitForLoadState('networkidle') // the dialog only becomes a modal after hydration
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
  await acceptArc(page, request)
  await queueFirstScene(request)
  await page.getByRole('button', { name: 'Start Session' }).click()
  await expect(page.getByRole('heading', { name: 'Session 1' })).toBeVisible()
  await page.waitForLoadState('networkidle')
}

test('plays a scene: a Declaration gets a Reply, an NPC answers, and the Character moves through an exit', async ({
  page,
  request
}) => {
  await startSession(page, request)
  const log = page.getByRole('list', { name: 'Story log' })
  const scene = page.getByRole('complementary', { name: 'Scene' })
  const declare = async (text: string) => {
    await page.getByLabel('Your action').fill(text)
    await page.getByRole('button', { name: 'Send' }).click()
  }

  // Exchange 1: the Declaration happens, and nothing changes; the Narrator replies.
  await script(request, [
    HAPPENS,
    { effect: 'none' },
    'The hearth crackles as the room turns to look at you.'
  ])
  await declare('I push open the door and step inside')
  await expect(log).toContainText('I push open the door and step inside')
  await expect(log).toContainText('The hearth crackles as the room turns to look at you.')
  await expect(page.getByLabel('Your action')).toBeEnabled()

  // Exchange 2: talking to Orla opens dialogue, and she voices the Reply.
  await script(request, [
    HAPPENS,
    { effect: 'talk', npcId: await npcId(request) },
    'Welcome in, traveller. Sit and warm yourself.'
  ])
  await declare('I greet the innkeeper')
  await expect(log).toContainText('Dialogue with Orla')
  await expect(log.getByRole('blockquote')).toContainText('Orla')
  await expect(log).toContainText('Welcome in, traveller. Sit and warm yourself.')
  await expect(scene.getByRole('region', { name: 'Mode' })).toContainText('dialogue')
  await expect(page.getByLabel('Your action')).toBeEnabled()

  // Exchange 3: the Character goes through the front door; the new place is generated first.
  await script(request, [
    HAPPENS,
    { effect: 'move', exitId: 'front-door' },
    {
      name: 'The Rain-Slick Yard',
      description: 'A muddy yard behind the inn.',
      exits: ['The stables'],
      objects: ['A water trough']
    },
    { npcs: [] },
    'Rain needles your face as the door bangs shut behind you.'
  ])
  await declare('I step back out into the rain')
  await expect(log).toContainText('You go through: Front door.')
  await expect(log).toContainText('Rain needles your face as the door bangs shut behind you.')
  await expect(scene.getByRole('region', { name: 'Location' })).toContainText('The Rain-Slick Yard')
  await expect(scene.getByRole('region', { name: 'Mode' })).toContainText('exploration')
  await expect(scene.getByRole('region', { name: 'Exits' })).toContainText('The Gilded Stag')
})

/**
 * A Check the fixture Character cannot pass whatever the die shows (Charisma 9, so Persuasion is
 * -1 against DC 25), so the journey does not depend on where the process-wide dice are.
 */
const PERSUADE = {
  outcome: 'check',
  skill: 'persuasion',
  difficulty: 'very_hard',
  question: '',
  choices: []
}

test('a Check raises a Call: rolling it shows the result and the Reply; typing over another withdraws it', async ({
  page,
  request
}) => {
  await startSession(page, request)
  const log = page.getByRole('list', { name: 'Story log' })
  const check = log.getByRole('group', { name: 'Check' })
  const declare = async (text: string) => {
    await page.getByLabel('Your action').fill(text)
    await page.getByRole('button', { name: 'Send' }).click()
  }

  // The Declaration raises a Check: the Exchange stops and waits on the Roll, with no DC shown.
  await script(request, [PERSUADE])
  await declare('I talk the guard into letting me pass')
  await expect(check).toContainText('Persuasion check')
  await expect(check).toContainText('I talk the guard into letting me pass')
  await expect(check).not.toContainText('DC')
  await expect(page.getByLabel('Your action')).toBeEnabled()

  // Rolling fails it: code logs the result, then the Narrator replies (no Effect on a failure).
  await script(request, ['The guard folds his arms and does not budge.'])
  await check.getByRole('button', { name: 'Roll' }).click()
  await expect(log).toContainText(/Persuasion: \d+ - 1 = \d+, failure/)
  await expect(log).toContainText('The guard folds his arms and does not budge.')
  await expect(check).toBeHidden()

  // Another Check, typed over: the Call is withdrawn and the new Declaration runs instead.
  await script(request, [PERSUADE])
  await declare('I try to charm him once more')
  await expect(check).toBeVisible()
  await script(request, [HAPPENS, { effect: 'none' }, 'You turn away and look for another way in.'])
  await declare('I give up and walk along the wall')
  await expect(log.getByText('Persuasion check withdrawn')).toHaveAttribute('data-withdrawn')
  await expect(log).toContainText('You turn away and look for another way in.')
  await expect(check).toBeHidden()
})

/** An Adjudication that asks what the player means, offering two choices. */
const WHICH_WAY = {
  outcome: 'ask',
  skill: 'none',
  difficulty: 'none',
  question: 'Which way do you go?',
  choices: ['The front door', 'The cellar stairs']
}

test('a question raises a Call: a choice or typed text answers it; "Do something else" withdraws it', async ({
  page,
  request
}) => {
  await startSession(page, request)
  const log = page.getByRole('list', { name: 'Story log' })
  const question = log.getByRole('group', { name: 'Question' })
  const input = page.getByLabel('Your action')
  const raise = async (text: string) => {
    await script(request, [WHICH_WAY])
    await input.fill(text)
    await page.getByRole('button', { name: 'Send' }).click()
    await expect(question).toContainText('Which way do you go?')
    await expect(input).toBeEnabled()
  }

  // An unclear Declaration raises a question; a choice answers it in one click, and the clarified
  // Declaration is ruled on and replied to.
  await raise('I leave')
  await script(request, [HAPPENS, { effect: 'none' }, 'You stay by the door, thinking.'])
  await question.getByRole('button', { name: 'The front door' }).click()
  await expect(log.getByText('The front door', { exact: true })).toHaveAttribute('data-answer')
  await expect(log).toContainText('You stay by the door, thinking.')
  await expect(question).toBeHidden()

  // Typed text answers it by default.
  await raise('I leave again')
  await script(request, [HAPPENS, { effect: 'none' }, 'You slip out of the back window.'])
  await input.fill('Out of the back window')
  await page.getByRole('button', { name: 'Answer' }).click()
  await expect(log.getByText('Out of the back window', { exact: true })).toHaveAttribute(
    'data-answer'
  )
  await expect(log).toContainText('You slip out of the back window.')

  // "Do something else" sends a new Declaration instead, withdrawing the question.
  await raise('I head off')
  await script(request, [HAPPENS, { effect: 'none' }, 'You order an ale instead.'])
  await input.fill('Actually, I order an ale')
  await page.getByRole('button', { name: 'Do something else' }).click()
  await expect(log.getByText('Question withdrawn')).toHaveAttribute('data-withdrawn')
  await expect(log).toContainText('You order an ale instead.')
  await expect(question).toBeHidden()
})
