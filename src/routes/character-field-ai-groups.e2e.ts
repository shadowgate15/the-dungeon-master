import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const FAKE_LM_STUDIO = 'http://127.0.0.1:1235'

const control = (request: APIRequestContext, path: string, data: unknown) =>
  request.post(`${FAKE_LM_STUDIO}/__control/${path}`, { data })

/** Queues whole structured answers (pick groups answer with `{ values }` or `{ option, wild }`). */
const queueObjects = (request: APIRequestContext, ...objects: unknown[]) =>
  control(request, 'answers', { answers: objects.map((content) => ({ content })) })

// The fake's scenario and answer queue are process-wide state.
test.describe.configure({ mode: 'serial' })
test.afterEach(async ({ request }) => {
  await control(request, 'scenario', { scenario: 'ready' })
  await control(request, 'answers', { answers: [], replace: true })
})

async function openWizard(page: Page) {
  await page.goto('/characters/new')
  await page.waitForLoadState('networkidle') // the draft only works after hydration
  await expect(page.getByText('fake-model')).toBeVisible()
}

const steps = (page: Page) => page.getByRole('navigation', { name: 'Steps' })
const combobox = (page: Page, name: string) => page.getByRole('combobox', { name, exact: true })
const goTo = (page: Page, step: RegExp) => steps(page).getByRole('button', { name: step }).click()

async function fighterOnAcolyte(page: Page) {
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Brenna')
  await combobox(page, 'Race').selectOption('human')
  await combobox(page, 'Class').selectOption('fighter')
  await combobox(page, 'Background').selectOption('acolyte')
}

test('a skills group generates exactly its picks, rejects illegal ones, and Undo restores', async ({
  page,
  request
}) => {
  await openWizard(page)
  await fighterOnAcolyte(page)
  await goTo(page, /Skills & features/)

  const skills = page.getByRole('button', { name: /^Generate Choose two skills .*\(Fighter\)$/ })
  await queueObjects(request, { values: ['skill-athletics', 'skill-history'] })
  await skills.click()
  await expect(page.getByRole('checkbox', { name: /Athletics/ }).first()).toBeChecked()
  await expect(page.getByRole('checkbox', { name: /History/ }).first()).toBeChecked()

  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByRole('checkbox', { name: /Athletics/ }).first()).not.toBeChecked()

  // A skill the Acolyte background already grants is not legal for the class group: rejected twice.
  await queueObjects(
    request,
    { values: ['skill-insight', 'skill-history'] },
    { values: ['skill-insight', 'skill-history'] }
  )
  await skills.click()
  await expect(page.getByRole('alert').filter({ hasText: 'unusable answer' })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: /History/ }).first()).not.toBeChecked()
})

test('an equipment group writes the option and its wildcard items', async ({ page, request }) => {
  await openWizard(page)
  await fighterOnAcolyte(page)
  await goTo(page, /Equipment/)

  const generateGear = page.getByRole('button', {
    name: /^Generate Fighter equipment: Any of Martial/
  })
  await queueObjects(request, { option: 0, wild: ['longsword'] })
  await generateGear.click()
  await expect(page.getByRole('combobox', { name: 'Martial Weapons item 1' })).toHaveValue(
    'longsword'
  )

  // An item outside the wildcard's category is rejected.
  await queueObjects(request, { option: 0, wild: ['club'] }, { option: 0, wild: ['club'] })
  await generateGear.click()
  await expect(page.getByRole('alert').filter({ hasText: 'unusable answer' })).toBeVisible()
})

test('class spell lists generate from the class list', async ({ page, request }) => {
  await openWizard(page)
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Merrin')
  await combobox(page, 'Race').selectOption('human')
  await combobox(page, 'Class').selectOption('wizard')
  await combobox(page, 'Background').selectOption('acolyte')
  await goTo(page, /Spells/)

  await queueObjects(request, { values: ['fire-bolt', 'light', 'mage-hand'] })
  await page.getByRole('button', { name: 'Generate Cantrips', exact: true }).click()
  await expect(page.getByRole('checkbox', { name: /Fire Bolt/ })).toBeChecked()
  await expect(page.getByRole('checkbox', { name: /Mage Hand/ })).toBeChecked()
})
