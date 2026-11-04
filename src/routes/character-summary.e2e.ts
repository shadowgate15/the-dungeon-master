import { expect, test } from '@playwright/test'
import { seedCharacter } from './character-helpers'

test('the summary shows a saved Character with every computed value', async ({ page }) => {
  const name = `Summary ${Date.now()}`
  const created = await seedCharacter(page, name)

  await page.goto(`/characters/${created.id}`)
  await expect(page.getByRole('heading', { name, level: 2 })).toBeVisible()
  await expect(page.getByRole('group', { name: 'STR' })).toContainText('16')
  await expect(page.getByRole('group', { name: 'Hit points' })).toContainText('12')
  const ac = page.getByRole('group', { name: 'Armor class (unarmored)' })
  await expect(ac).toContainText('12')
  await expect(ac).toContainText('10 + DEX')
  await expect(page.getByText('Longsword: +5 to hit')).toBeVisible()
  await expect(page.getByRole('status')).toHaveCount(0)
})

test('the list links to the summary', async ({ page }) => {
  const name = `Linked ${Date.now()}`
  const created = await seedCharacter(page, name)
  await page.getByRole('link', { name }).click()
  await expect(page).toHaveURL(new RegExp(`/characters/${created.id}$`))
})

test('a stale id is a 404', async ({ page }) => {
  const response = await page.goto('/characters/does-not-exist')
  expect(response?.status()).toBe(404)
})

test('creating through the save endpoint lands on a summary with a success toast', async ({
  page
}) => {
  const created = await seedCharacter(page, `Template ${Date.now()}`)
  const name = `Saved ${Date.now()}`
  const posted = await page.request.post('/api/characters', {
    data: {
      name,
      race: 'human',
      class: 'fighter',
      background: 'acolyte',
      abilityMethod: 'standard-array',
      scores: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
      picks: {
        'class/fighter/proficiency-0': ['skill-athletics', 'skill-intimidation'],
        'class/fighter/fightingStyle-0': ['fighter-fighting-style-defense'],
        'race/human/language-0': ['dwarvish'],
        'background/acolyte/language-0': ['elvish', 'halfling']
      },
      equipment: [
        { choiceKey: 'class/fighter/equipment-0', item: 'chain-mail' },
        { choiceKey: 'class/fighter/equipment-1', item: 'longsword' },
        { choiceKey: 'class/fighter/equipment-2', item: 'crossbow-light' },
        { choiceKey: 'class/fighter/equipment-3', item: 'dungeoneers-pack' }
      ]
    }
  })
  expect(posted.status()).toBe(201)
  const { id } = await posted.json()
  expect(id).not.toBe(created.id)

  await page.goto(`/characters/${id}?saved`)
  await expect(page.getByRole('status')).toContainText(`Saved ${name}`)
  await expect(page).toHaveURL(new RegExp(`/characters/${id}$`))

  const bad = await page.request.post('/api/characters', { data: { name: '' } })
  expect(bad.status()).toBe(400)
})

test('an archived Character is viewable but offers no editing', async ({ page }) => {
  const name = `Archived view ${Date.now()}`
  const created = await seedCharacter(page, name)
  await page.waitForLoadState('networkidle')
  await page
    .getByRole('row')
    .filter({ hasText: name })
    .getByRole('button', { name: 'Archive' })
    .click()
  await expect(page.getByRole('status')).toContainText(`Archived ${name}`)

  await page.goto(`/characters/${created.id}`)
  await expect(page.getByRole('heading', { name, level: 2 })).toBeVisible()
  await expect(page.getByText('This Character is archived')).toBeVisible()
  await expect(page.getByRole('link', { name: /^edit/i })).toHaveCount(0)
})
