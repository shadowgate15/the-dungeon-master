import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const FAKE_LM_STUDIO = 'http://127.0.0.1:1235'

const control = (request: APIRequestContext, path: string, data: unknown) =>
  request.post(`${FAKE_LM_STUDIO}/__control/${path}`, { data })

const queueScores = (request: APIRequestContext, scores: Record<string, number>) =>
  control(request, 'answers', { answers: [{ content: { scores } }] })

const queueValue = (request: APIRequestContext, value: string) =>
  control(request, 'answers', { answers: [{ content: { value } }] })

// The fake's scenario and answer queue are process-wide state.
test.describe.configure({ mode: 'serial' })
test.afterEach(async ({ request }) => {
  await control(request, 'scenario', { scenario: 'ready' })
  await control(request, 'answers', { answers: [], replace: true })
})

const combobox = (page: Page, name: string) => page.getByRole('combobox', { name, exact: true })
const generate = (page: Page, label: string) =>
  page.getByRole('button', { name: `Generate ${label}`, exact: true })

async function openAbilities(page: Page) {
  await page.goto('/characters/new')
  await page.waitForLoadState('networkidle') // the draft only works after hydration
  await expect(page.getByText('fake-model')).toBeVisible()
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Brenna')
  await combobox(page, 'Race').selectOption('human')
  await combobox(page, 'Class').selectOption('fighter')
  await combobox(page, 'Background').selectOption('acolyte')
  await page
    .getByRole('navigation', { name: 'Steps' })
    .getByRole('button', { name: /Ability scores/ })
    .click()
}

test('the method button sets the method and never rolls; the arrangement waits for a method', async ({
  page,
  request
}) => {
  await openAbilities(page)
  await expect(generate(page, 'Ability scores')).toHaveAttribute('aria-disabled', 'true')
  await expect(page.getByLabel('Message')).toHaveCount(0)

  await queueValue(request, 'rolling')
  await generate(page, 'Ability score method').click()
  await expect(combobox(page, 'Ability score method')).toHaveValue('rolling')
  await expect(page.getByLabel('Roll 1')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Roll scores' })).toBeVisible()
  await expect(generate(page, 'Ability scores')).not.toHaveAttribute('aria-disabled', 'true')
})

test('arranges a point buy and the standard array, and Undo restores the previous assignment', async ({
  page,
  request
}) => {
  await openAbilities(page)

  await combobox(page, 'Ability score method').selectOption('point-buy')
  await queueScores(request, { str: 15, dex: 14, con: 13, int: 8, wis: 8, cha: 8 })
  await generate(page, 'Ability scores').click()
  await expect(page.getByTestId('base-str')).toHaveText('15')
  await expect(page.getByTestId('points-remaining')).toHaveText('6')
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByTestId('base-str')).toHaveText('8')

  await combobox(page, 'Ability score method').selectOption('standard-array')
  await queueScores(request, { str: 8, dex: 14, con: 13, int: 12, wis: 10, cha: 15 })
  await generate(page, 'Ability scores').click()
  await expect(combobox(page, 'Charisma base score')).toHaveValue('15')
  await expect(combobox(page, 'Strength base score')).toHaveValue('8')
})

test('arranging rolls first when no set exists, Undo takes the roll back, and a reroll resets', async ({
  page,
  request
}) => {
  // Every die is a 4, so every rolled total is 12.
  await page.addInitScript(() => {
    Math.random = () => 0.5
  })
  await openAbilities(page)
  await combobox(page, 'Ability score method').selectOption('rolling')
  await expect(page.getByLabel('Roll 1')).toHaveCount(0)

  const twelves = { str: 12, dex: 12, con: 12, int: 12, wis: 12, cha: 12 }
  await queueScores(request, twelves)
  await generate(page, 'Ability scores').click()
  await expect(page.getByLabel('Roll 1')).toHaveCount(1)
  await expect(combobox(page, 'Strength base score')).toHaveValue('12')

  // Undo restores the assignment and the (empty) rolled set.
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByLabel('Roll 1')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Roll scores' })).toBeVisible()

  // With a set, arranging does not roll again; the Roll button still resets assignments.
  await page.getByRole('button', { name: 'Roll scores' }).click()
  await queueScores(request, twelves)
  await generate(page, 'Ability scores').click()
  await expect(combobox(page, 'Strength base score')).toHaveValue('12')
  await page.getByRole('button', { name: 'Reroll all' }).click()
  await expect(combobox(page, 'Strength base score')).toHaveValue('')
})
