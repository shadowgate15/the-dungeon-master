import { page, userEvent } from 'vitest/browser'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import WorldTable, { type WorldListItem } from './WorldTable.svelte'

const world = (
  over: Partial<WorldListItem> & Pick<WorldListItem, 'id' | 'name'>
): WorldListItem => ({
  premise: null,
  genreFlavor: null,
  scale: null,
  magicLevel: null,
  techLevel: null,
  updatedAt: 1000,
  campaigns: 0,
  ...over
})

const ashfall = world({
  id: 'w1',
  name: 'Ashfall',
  premise: 'A volcanic frontier.',
  genreFlavor: 'dark fantasy',
  scale: 'single region',
  magicLevel: 'low',
  techLevel: 'medieval',
  updatedAt: 3000,
  campaigns: 2
})
const bramble = world({ id: 'w2', name: 'Bramble', genreFlavor: 'high fantasy', updatedAt: 1000 })
const cinder = world({
  id: 'w3',
  name: 'Cinder',
  genreFlavor: 'post-apocalyptic',
  updatedAt: 2000,
  campaigns: 1
})

const props = (over: Record<string, unknown> = {}) => ({
  worlds: [ashfall, bramble, cinder],
  view: 'active' as const,
  activeCount: 3,
  archivedCount: 1,
  ...over
})

const rowNames = () =>
  page
    .getByRole('row')
    .elements()
    .slice(1)
    .map((row) => row.querySelector('a')?.textContent)

describe('WorldTable', () => {
  it('shows each World with its seed fields and Campaign count, dashes for unspecified', async () => {
    render(WorldTable, props())

    const row = page.getByRole('row', { name: /Ashfall/ })
    await expect.element(row.getByText('dark fantasy')).toBeVisible()
    await expect.element(row.getByText('single region')).toBeVisible()
    await expect.element(row.getByText('low', { exact: true })).toBeVisible()
    await expect.element(row.getByText('medieval')).toBeVisible()
    await expect.element(row.getByRole('cell', { name: '2', exact: true })).toBeVisible()
    await expect
      .element(row.getByRole('link', { name: 'Ashfall' }))
      .toHaveAttribute('href', '/worlds/w1/edit')
    // Bramble leaves scale, magic, tech and Campaigns unspecified.
    await expect
      .element(
        page
          .getByRole('row', { name: /Bramble/ })
          .getByText('—')
          .first()
      )
      .toBeVisible()
  })

  it('links the Active and Archived views with their counts, marking the current one', async () => {
    render(WorldTable, props({ view: 'archived', worlds: [] }))

    await expect.element(page.getByRole('link', { name: 'Active 3' })).toHaveAttribute('href', '/')
    await expect
      .element(page.getByRole('link', { name: 'Archived 1' }))
      .toHaveAttribute('aria-current', 'page')
    await expect.element(page.getByText('No archived Worlds.')).toBeVisible()
  })

  it('offers Archive on Active Worlds and Restore on archived ones', async () => {
    const { unmount } = render(WorldTable, props())
    await expect
      .element(page.getByRole('row', { name: /Ashfall/ }).getByRole('button', { name: 'Archive' }))
      .toBeVisible()
    unmount()

    render(WorldTable, props({ view: 'archived', worlds: [ashfall] }))
    await expect
      .element(page.getByRole('row', { name: /Ashfall/ }).getByRole('button', { name: 'Restore' }))
      .toBeVisible()
    await expect.element(page.getByRole('button', { name: 'Archive' })).not.toBeInTheDocument()
  })

  it('filters by name or premise as you type', async () => {
    render(WorldTable, props())

    await userEvent.fill(page.getByRole('searchbox', { name: 'Search Worlds' }), 'volcanic')
    await expect.poll(rowNames).toEqual(['Ashfall'])

    await userEvent.fill(page.getByRole('searchbox', { name: 'Search Worlds' }), 'bram')
    await expect.poll(rowNames).toEqual(['Bramble'])

    await userEvent.fill(page.getByRole('searchbox', { name: 'Search Worlds' }), 'nothing here')
    await expect.element(page.getByText('No Worlds match.')).toBeVisible()
  })

  it('filters by genre flavor, offering only genres that appear', async () => {
    render(WorldTable, props())

    const select = page.getByRole('combobox', { name: 'Genre' })
    await expect.element(select.getByRole('option', { name: 'mythic' })).not.toBeInTheDocument()

    await userEvent.selectOptions(select, 'high fantasy')
    await expect.poll(rowNames).toEqual(['Bramble'])
  })

  it('drops a genre filter the next view no longer offers', async () => {
    const { rerender } = render(WorldTable, props())
    await userEvent.selectOptions(page.getByRole('combobox', { name: 'Genre' }), 'high fantasy')
    await expect.poll(rowNames).toEqual(['Bramble'])

    await rerender(props({ view: 'archived', worlds: [ashfall] }))

    await expect.poll(rowNames).toEqual(['Ashfall'])
  })

  it('sorts by most recently updated first, and re-sorts by name, Campaigns or updated', async () => {
    render(WorldTable, props())
    await expect.poll(rowNames).toEqual(['Ashfall', 'Cinder', 'Bramble'])

    await userEvent.click(page.getByRole('button', { name: 'Name' }))
    await expect.poll(rowNames).toEqual(['Ashfall', 'Bramble', 'Cinder'])
    await userEvent.click(page.getByRole('button', { name: 'Name' }))
    await expect.poll(rowNames).toEqual(['Cinder', 'Bramble', 'Ashfall'])

    await userEvent.click(page.getByRole('button', { name: 'Campaigns' }))
    await expect.poll(rowNames).toEqual(['Ashfall', 'Cinder', 'Bramble'])

    await userEvent.click(page.getByRole('button', { name: 'Updated' }))
    await expect.poll(rowNames).toEqual(['Ashfall', 'Cinder', 'Bramble'])
    await userEvent.click(page.getByRole('button', { name: 'Updated' }))
    await expect.poll(rowNames).toEqual(['Bramble', 'Cinder', 'Ashfall'])
  })

  describe('selection', () => {
    // What the bulk form would submit: the ids of the checked rows.
    const submittedIds = () => {
      const form = document.querySelector<HTMLFormElement>('form#bulk-actions')!
      return new FormData(form).getAll('id')
    }

    it('shows a bulk bar for the selected Worlds that archives exactly those', async () => {
      render(WorldTable, props())
      await expect.element(page.getByText(/selected/)).not.toBeInTheDocument()

      await userEvent.click(page.getByRole('checkbox', { name: 'Select Ashfall' }))
      await userEvent.click(page.getByRole('checkbox', { name: 'Select Cinder' }))

      await expect.element(page.getByText('2 selected')).toBeVisible()
      expect(submittedIds().sort()).toEqual(['w1', 'w3'])
      const archive = page.getByRole('button', { name: 'Archive selected' })
      await expect.element(archive).toHaveAttribute('formaction', '?/archive')
      await expect.element(archive).toHaveAttribute('form', 'bulk-actions')
    })

    it('selects every World the filters leave visible, and clears', async () => {
      render(WorldTable, props())
      await userEvent.selectOptions(page.getByRole('combobox', { name: 'Genre' }), 'high fantasy')

      await userEvent.click(page.getByRole('checkbox', { name: 'Select all' }))
      await expect.element(page.getByText('1 selected')).toBeVisible()
      expect(submittedIds()).toEqual(['w2'])

      await userEvent.click(page.getByRole('button', { name: 'Clear selection' }))
      await expect.element(page.getByText(/selected/)).not.toBeInTheDocument()
    })

    it('restores the selection in the archived view', async () => {
      render(WorldTable, props({ view: 'archived', worlds: [ashfall] }))
      await userEvent.click(page.getByRole('checkbox', { name: 'Select Ashfall' }))

      const restore = page.getByRole('button', { name: 'Restore selected' })
      await expect.element(restore).toHaveAttribute('formaction', '?/restore&view=archived')
    })

    it('forgets a selected World once a filter hides it', async () => {
      render(WorldTable, props())
      await userEvent.click(page.getByRole('checkbox', { name: 'Select Ashfall' }))

      await userEvent.fill(page.getByRole('searchbox', { name: 'Search Worlds' }), 'bramble')

      await expect.element(page.getByText(/selected/)).not.toBeInTheDocument()
      expect(submittedIds()).toEqual([])
    })
  })

  describe('delete', () => {
    it('asks for confirmation before deleting, and Cancel backs out', async () => {
      render(WorldTable, props())
      const row = page.getByRole('row', { name: /Bramble/ })

      await userEvent.click(row.getByRole('button', { name: 'Delete' }))
      await expect.element(row.getByText('Delete forever?')).toBeVisible()
      await expect.element(row.getByRole('button', { name: 'Confirm delete' })).toBeVisible()

      await userEvent.click(row.getByRole('button', { name: 'Cancel' }))
      await expect.element(row.getByText('Delete forever?')).not.toBeInTheDocument()
      await expect.element(row.getByRole('button', { name: 'Delete' })).toBeVisible()
    })

    it('cannot delete a World that a Campaign uses, and says why', async () => {
      render(WorldTable, props())
      const row = page.getByRole('row', { name: /Ashfall/ })

      await expect.element(row.getByRole('button', { name: 'Delete' })).toBeDisabled()
      await expect.element(row.getByText('Used by 2 Campaigns. Archive it instead.')).toBeVisible()
    })

    it('says "Keep it archived" for an archived World that a Campaign uses', async () => {
      render(WorldTable, props({ view: 'archived', worlds: [ashfall] }))

      await expect.element(page.getByText('Used by 2 Campaigns. Keep it archived.')).toBeVisible()
    })
  })
})
