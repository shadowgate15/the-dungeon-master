import { page } from 'vitest/browser'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { sheets } from './play-fixtures'
import CharacterSheet from './CharacterSheet.svelte'

describe('CharacterSheet', () => {
  it("shows the acting Character's full sheet", async () => {
    render(CharacterSheet, { sheets, acting: 'wren' })

    const sheet = page.getByRole('tabpanel', { name: 'Wren' })
    await expect.element(sheet.getByRole('group', { name: 'HP' })).toHaveTextContent('9 / 12')
    await expect.element(sheet.getByRole('group', { name: 'AC' })).toHaveTextContent('14')
    await expect.element(sheet.getByText('Poisoned')).toBeVisible()
    await expect.element(sheet.getByText('Concentrating: Bless')).toBeVisible()
    await expect.element(sheet.getByRole('group', { name: 'DEX' })).toHaveTextContent(/\+3\s*16/)
    await expect.element(sheet.getByText('Shortbow')).toBeVisible()
    await expect.element(sheet.getByText('+5 · 1d6+3 piercing')).toBeVisible()
    await expect
      .element(sheet.getByRole('group', { name: 'Level 1 slots' }))
      .toHaveTextContent('1 / 2')
    await expect.element(sheet.getByText('Second Wind · 1 used')).toBeVisible()
    await expect.element(sheet.getByText('Rope, hempen (50 feet)')).toBeVisible()
    await expect.element(sheet.getByText('Arrow × 20')).toBeVisible()
  })

  it('switches the acting Character with the tabs', async () => {
    let acting = 'wren'
    render(CharacterSheet, {
      sheets,
      acting,
      onselect: (id: string) => (acting = id)
    })

    await page.getByRole('tab', { name: /Bram/ }).click()

    expect(acting).toBe('bram')
  })

  it("shows a Character's whereabouts on their tab", async () => {
    render(CharacterSheet, { sheets, acting: 'wren' })

    await expect.element(page.getByRole('tab', { name: /Bram/ })).toHaveTextContent('the cellar')
  })

  it('only lets Characters who can act be selected', async () => {
    render(CharacterSheet, { sheets, acting: 'wren' })

    await expect.element(page.getByRole('tab', { name: /Wren/ })).toBeEnabled()
    await expect.element(page.getByRole('tab', { name: /Osric/ })).toBeDisabled()
  })
})
