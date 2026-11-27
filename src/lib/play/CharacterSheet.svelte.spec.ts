import { page } from 'vitest/browser'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { levelUpOffer, sheets } from './play-fixtures'
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

  it('opens the tab of a Character elsewhere, labelled with their Place', async () => {
    let selected = ''
    render(CharacterSheet, { sheets, acting: 'wren', onselect: (id: string) => (selected = id) })

    const tab = page.getByRole('tab', { name: /Bram/ })
    await expect.element(tab).toBeEnabled()
    await tab.click()

    expect(selected).toBe('bram')
  })

  it('only lets Characters who can act be selected', async () => {
    render(CharacterSheet, { sheets, acting: 'wren' })

    await expect.element(page.getByRole('tab', { name: /Wren/ })).toBeEnabled()
    await expect.element(page.getByRole('tab', { name: /Osric/ })).toBeDisabled()
  })

  it('shows Hit Dice, coin and what is equipped', async () => {
    render(CharacterSheet, { sheets, acting: 'wren' })

    const sheet = page.getByRole('tabpanel', { name: 'Wren' })
    await expect
      .element(sheet.getByRole('group', { name: 'Hit Dice' }))
      .toHaveTextContent('1 / 1 d10')
    await expect
      .element(sheet.getByRole('group', { name: 'Coin' }))
      .toHaveTextContent('12 gp, 4 sp')
    await expect.element(sheet.getByText('Leather Armor (equipped)')).toBeVisible()
    await expect
      .element(sheet.getByRole('group', { name: 'AC' }))
      .toHaveAttribute('title', 'AC (Leather Armor)')
  })

  it("shows a downed Character's Death save tallies", async () => {
    render(CharacterSheet, { sheets, acting: 'osric' })

    const osric = page.getByRole('tabpanel', { name: 'Osric' })
    const tallies = osric.getByRole('group', { name: 'Death saves' })
    await expect.element(tallies).toHaveTextContent('Successes 1 / 3')
    await expect.element(tallies).toHaveTextContent('Failures 2 / 3')
    await expect.element(osric.getByText('Unconscious')).toBeVisible()
  })

  it('marks a stable Character as stable', async () => {
    const stable = sheets.map((s) =>
      s.id === 'osric' ? { ...s, deathSaves: { successes: 0, failures: 0, stable: true } } : s
    )
    render(CharacterSheet, { sheets: stable, acting: 'osric' })

    await expect
      .element(page.getByRole('group', { name: 'Death saves' }))
      .toHaveTextContent('Stable')
  })

  it('shows no Death saves for a Character with HP', async () => {
    render(CharacterSheet, { sheets, acting: 'wren' })

    await expect.element(page.getByRole('tabpanel', { name: 'Wren' })).toBeVisible()
    await expect.element(page.getByRole('group', { name: 'Death saves' })).not.toBeInTheDocument()
  })

  it('hides Level up until the DM awards a level', async () => {
    render(CharacterSheet, { sheets, acting: 'wren', onlevelup: () => {} })

    await expect.element(page.getByRole('button', { name: /Level up/ })).not.toBeInTheDocument()
  })

  it('levels up with the picked spells once the DM awards a level', async () => {
    const taken: { id: string; picks: { cantrips: string[]; spells: string[] } }[] = []
    const awarded = sheets.map((s) => (s.id === 'wren' ? { ...s, levelUp: levelUpOffer } : s))
    render(CharacterSheet, {
      sheets: awarded,
      acting: 'wren',
      onlevelup: (id: string, picks: { cantrips: string[]; spells: string[] }) =>
        taken.push({ id, picks })
    })

    await page.getByRole('button', { name: 'Level up to 2' }).click()
    const take = page.getByRole('button', { name: 'Take level 2' })
    await expect.element(take).toBeDisabled()
    await page.getByRole('checkbox', { name: 'Sleep' }).click()
    await page.getByRole('checkbox', { name: 'Shield' }).click()
    // Two spells are picked: the rest cannot be.
    await expect.element(page.getByRole('checkbox', { name: 'Magic Missile' })).toBeDisabled()
    await take.click()

    expect(taken).toEqual([{ id: 'wren', picks: { cantrips: [], spells: ['shield', 'sleep'] } }])
  })

  it('edits notes, personality and appearance, and shows the backstory read-only', async () => {
    const saved: { id: string; details: Record<string, string | null> }[] = []
    render(CharacterSheet, {
      sheets,
      acting: 'wren',
      onsavedetails: async (id: string, details: Record<string, string | null>) => {
        saved.push({ id, details })
      }
    })

    const details = page.getByRole('region', { name: 'Details' })
    await expect
      .element(details.getByText('Raised on the Ember Road by a caravan guard.'))
      .toBeVisible()
    await expect
      .element(details.getByRole('textbox', { name: 'Backstory' }))
      .not.toBeInTheDocument()
    await expect
      .element(details.getByRole('textbox', { name: 'Personality' }))
      .toHaveValue('Wry and watchful')

    await details.getByRole('textbox', { name: 'Notes' }).fill('Owes Tam a favour')
    await details.getByRole('textbox', { name: 'Appearance' }).fill('A scar over one eye')
    await details.getByRole('button', { name: 'Save details' }).click()

    expect(saved).toEqual([
      {
        id: 'wren',
        details: {
          notes: 'Owes Tam a favour',
          personality: 'Wry and watchful',
          appearance: 'A scar over one eye'
        }
      }
    ])
    await expect.element(details.getByRole('status')).toHaveTextContent('Saved')
  })

  it("shows the server's refusal of an edit", async () => {
    render(CharacterSheet, {
      sheets,
      acting: 'wren',
      onsavedetails: async () => {
        throw new Error('notes must be at most 4000 characters')
      }
    })
    const details = page.getByRole('region', { name: 'Details' })
    await details.getByRole('button', { name: 'Save details' }).click()
    await expect
      .element(details.getByRole('alert'))
      .toHaveTextContent('notes must be at most 4000 characters')
  })
})
