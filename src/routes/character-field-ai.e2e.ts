import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { seedCharacter } from './character-helpers'

const FAKE_LM_STUDIO = 'http://127.0.0.1:1235'

const control = (request: APIRequestContext, path: string, data: unknown) =>
  request.post(`${FAKE_LM_STUDIO}/__control/${path}`, { data })

/** Queues the exact answers the fake gives, in order. A regenerated value must differ. */
const queue = (request: APIRequestContext, ...values: string[]) =>
  control(request, 'answers', { answers: values.map((value) => ({ content: { value } })) })

/** The body of the last request the fake received, as text. */
async function lastRequest(request: APIRequestContext) {
  const sent = (await (await request.get(`${FAKE_LM_STUDIO}/__control/requests`)).json()) as {
    body: unknown
  }[]
  return JSON.stringify(sent[sent.length - 1].body)
}

// The fake's scenario and answer queue are process-wide state.
test.describe.configure({ mode: 'serial' })
test.afterEach(async ({ request }) => {
  await control(request, 'scenario', { scenario: 'ready' })
  await control(request, 'answers', { answers: [], replace: true })
})

async function openWizard(page: Page, url = '/characters/new') {
  await page.goto(url)
  await page.waitForLoadState('networkidle') // the draft only works after hydration
  await expect(page.getByText('fake-model')).toBeVisible()
}

const steps = (page: Page) => page.getByRole('navigation', { name: 'Steps' })
const textbox = (page: Page, name: string) => page.getByRole('textbox', { name, exact: true })
const combobox = (page: Page, name: string) => page.getByRole('combobox', { name, exact: true })
const generate = (page: Page, label: string) =>
  page.getByRole('button', { name: `Generate ${label}`, exact: true })
const goTo = (page: Page, step: RegExp) => steps(page).getByRole('button', { name: step }).click()

test('the wizard has no chat and a control on every Concept field', async ({ page }) => {
  await openWizard(page)

  await expect(page.getByLabel('Message')).toHaveCount(0)
  await expect(page.getByRole('complementary')).toHaveCount(0)
  for (const label of [
    'Name',
    'Race',
    'Class',
    'Background',
    'Alignment',
    'Appearance',
    'Personality traits',
    'Ideal',
    'Bond',
    'Flaw',
    'Backstory'
  ]) {
    await expect(generate(page, label)).toBeVisible()
    await expect(
      page.getByRole('button', { name: `Give feedback on ${label}`, exact: true })
    ).toBeVisible()
  }
})

test('Generate, Feedback and Undo on text and Rules Data fields, then a custom background', async ({
  page,
  request
}) => {
  await openWizard(page)

  await queue(request, 'Brenna Ironhand')
  await generate(page, 'Name').click()
  await expect(textbox(page, 'Name')).toHaveValue('Brenna Ironhand')

  await queue(request, 'dwarf')
  await generate(page, 'Race').click()
  await expect(combobox(page, 'Race')).toHaveValue('dwarf')

  // Subrace offers only the chosen race's subraces.
  await queue(request, 'hill-dwarf')
  await generate(page, 'Subrace').click()
  await expect(combobox(page, 'Subrace')).toHaveValue('hill-dwarf')
  const body = await lastRequest(request)
  expect(body).toContain('- Race: Dwarf')
  expect(body).toContain('- Name: Brenna Ironhand')

  await queue(request, 'A scarred dwarf with a braided beard.')
  await generate(page, 'Appearance').click()
  await expect(textbox(page, 'Appearance')).toHaveValue('A scarred dwarf with a braided beard.')

  await queue(request, 'A scarred dwarf with a braided beard and a bright smile.')
  await page.getByRole('button', { name: 'Give feedback on Appearance', exact: true }).click()
  const feedback = page.getByRole('dialog', { name: 'Feedback on Appearance' })
  await feedback.getByLabel('What should change?').fill('friendlier')
  await feedback.getByRole('button', { name: 'Revise' }).click()
  await expect(textbox(page, 'Appearance')).toHaveValue(/bright smile/)
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(textbox(page, 'Appearance')).toHaveValue('A scarred dwarf with a braided beard.')

  // The custom background's name first, then its feature, given the name.
  await combobox(page, 'Class').selectOption('cleric')
  await combobox(page, 'Background').selectOption('custom')
  await goTo(page, /Skills & features/)
  await queue(request, 'Road Warden')
  await generate(page, 'Background name').click()
  await expect(textbox(page, 'Background name')).toHaveValue('Road Warden')
  await queue(request, 'You know every safe road.')
  await generate(page, 'Background feature').click()
  await expect(textbox(page, 'Background feature')).toHaveValue('You know every safe road.')
  expect(await lastRequest(request)).toContain('- Background name: Road Warden')
})

test('regenerating Class clears Skills choices like a manual edit, and Undo restores them', async ({
  page,
  request
}) => {
  await openWizard(page)
  await textbox(page, 'Name').fill('Brenna')
  await combobox(page, 'Race').selectOption('human')
  await combobox(page, 'Class').selectOption('fighter')
  await combobox(page, 'Background').selectOption('acolyte')

  await goTo(page, /Skills & features/)
  await page
    .getByRole('checkbox', { name: /Athletics/ })
    .first()
    .check()
  await goTo(page, /Concept/)

  await queue(request, 'cleric')
  await generate(page, 'Class').click()
  await expect(combobox(page, 'Class')).toHaveValue('cleric')
  await expect(page.getByText('Cleared your Fighter choices')).toBeVisible()

  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(combobox(page, 'Class')).toHaveValue('fighter')
  await expect(page.getByText('Cleared your Fighter choices')).toHaveCount(0)
  await goTo(page, /Skills & features/)
  await expect(page.getByRole('checkbox', { name: /Athletics/ }).first()).toBeChecked()

  // Undo expires on the next edit.
  await goTo(page, /Concept/)
  await queue(request, 'cleric')
  await generate(page, 'Class').click()
  await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible()
  await textbox(page, 'Name').fill('Brenna the Bold')
  await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(0)
})

test('the edit flow has the same controls and saves an AI-written field', async ({
  page,
  request
}) => {
  const created = await seedCharacter(page, 'Edita')
  await openWizard(page, `/characters/${created.id}/edit`)

  await expect(page.getByLabel('Message')).toHaveCount(0)
  await queue(request, 'Born under a failing star.')
  await generate(page, 'Backstory').click()
  await expect(textbox(page, 'Backstory')).toHaveValue('Born under a failing star.')

  await goTo(page, /Review/)
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page).toHaveURL(/\/characters\/[^/?]+(\?saved)?$/)
  await expect(page.getByText('Born under a failing star.')).toBeVisible()
})

test('bad output shows Retry inline and leaves the value unchanged', async ({ page, request }) => {
  await openWizard(page)
  await textbox(page, 'Name').fill('Keep Me')
  // An illegal slug twice: the single retry fails too.
  await queue(request, 'space-wizard', 'space-wizard')
  await generate(page, 'Race').click()
  await expect(page.getByRole('alert').filter({ hasText: 'unusable answer' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible()
  await expect(combobox(page, 'Race')).toHaveValue('')
  await expect(textbox(page, 'Name')).toHaveValue('Keep Me')
})
