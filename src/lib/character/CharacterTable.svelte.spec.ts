import { createRawSnippet } from 'svelte'
import { page } from 'vitest/browser'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import CharacterTable, { type CharacterListItem } from './CharacterTable.svelte'

const brannoch: CharacterListItem = {
  id: 'ch1',
  name: 'Brannoch',
  raceName: 'Dwarf',
  subraceName: 'Hill Dwarf',
  className: 'Cleric',
  backgroundName: 'Acolyte',
  level: 1,
  updatedAt: Date.UTC(2026, 10, 2)
}

const props = (over: Record<string, unknown> = {}) => ({
  characters: [brannoch],
  view: 'active' as const,
  activeCount: 1,
  archivedCount: 2,
  ...over
})

describe('CharacterTable', () => {
  it('shows name with a muted summary line, race, class, background, level and updated date', async () => {
    render(CharacterTable, props())

    const row = page.getByRole('row', { name: /Brannoch/ })
    await expect
      .element(row.getByRole('link', { name: 'Brannoch' }))
      .toHaveAttribute('href', '/characters/ch1')
    await expect.element(row.getByText('Hill Dwarf Cleric · Acolyte')).toBeVisible()
    await expect.element(row.getByRole('cell', { name: 'Dwarf', exact: true })).toBeVisible()
    await expect.element(row.getByRole('cell', { name: 'Cleric', exact: true })).toBeVisible()
    await expect.element(row.getByRole('cell', { name: 'Acolyte', exact: true })).toBeVisible()
    await expect.element(row.getByRole('cell', { name: '1', exact: true })).toBeVisible()
    await expect.element(row.getByText('2026-11-02')).toBeVisible()
  })

  it('uses the race name alone in the summary line when there is no subrace', async () => {
    render(CharacterTable, props({ characters: [{ ...brannoch, subraceName: null }] }))

    await expect.element(page.getByText('Dwarf Cleric · Acolyte')).toBeVisible()
  })

  it('links the Active and Archived views with their counts, marking the current one', async () => {
    render(CharacterTable, props({ view: 'archived', characters: [] }))

    await expect
      .element(page.getByRole('link', { name: 'Active 1' }))
      .toHaveAttribute('href', '/characters')
    await expect
      .element(page.getByRole('link', { name: 'Archived 2' }))
      .toHaveAttribute('aria-current', 'page')
    await expect.element(page.getByText('No archived Characters.')).toBeVisible()
  })

  it('says there are no Characters yet when the Active view is empty', async () => {
    render(CharacterTable, props({ characters: [], activeCount: 0 }))

    await expect.element(page.getByText('No Characters yet.')).toBeVisible()
  })

  it('renders the actions snippet for each row', async () => {
    const actions = createRawSnippet((character: () => CharacterListItem) => ({
      render: () => `<span>act ${character().id}</span>`
    }))
    render(CharacterTable, props({ actions }))

    await expect.element(page.getByText('act ch1')).toBeVisible()
  })
})
