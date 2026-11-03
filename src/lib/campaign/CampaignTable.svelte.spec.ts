import { createRawSnippet } from 'svelte'
import { page } from 'vitest/browser'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import CampaignTable, { type CampaignListItem } from './CampaignTable.svelte'

const ember: CampaignListItem = {
  id: 'c1',
  name: 'Ember Road',
  premise: 'Escort a relic across the ash plains.',
  tone: 'tense',
  length: 'short',
  updatedAt: Date.UTC(2026, 10, 2),
  worlds: [
    { id: 'w1', name: 'Ashfall', archived: false },
    { id: 'w2', name: 'Bramble', archived: true }
  ]
}

const props = (over: Record<string, unknown> = {}) => ({
  campaigns: [ember],
  view: 'active' as const,
  activeCount: 1,
  archivedCount: 2,
  ...over
})

describe('CampaignTable', () => {
  it('shows name with premise, tone, length, Worlds as chips and the updated date', async () => {
    render(CampaignTable, props())

    const row = page.getByRole('row', { name: /Ember Road/ })
    await expect.element(row.getByText('Escort a relic across the ash plains.')).toBeVisible()
    await expect.element(row.getByRole('cell', { name: 'tense', exact: true })).toBeVisible()
    await expect.element(row.getByRole('cell', { name: 'short', exact: true })).toBeVisible()
    await expect.element(row.getByRole('link', { name: 'Ashfall' })).toBeVisible()
    await expect.element(row.getByRole('link', { name: 'Bramble' })).toBeVisible()
    await expect.element(row.getByText('2026-11-02')).toBeVisible()
  })

  it('strikes through archived Worlds', async () => {
    render(CampaignTable, props())

    await expect.element(page.getByRole('link', { name: 'Bramble' })).toHaveClass(/line-through/)
    await expect
      .element(page.getByRole('link', { name: 'Ashfall' }))
      .not.toHaveClass(/line-through/)
  })

  it('links the Active and Archived views with their counts, marking the current one', async () => {
    render(CampaignTable, props({ view: 'archived', campaigns: [] }))

    await expect
      .element(page.getByRole('link', { name: 'Active 1' }))
      .toHaveAttribute('href', '/campaigns')
    await expect
      .element(page.getByRole('link', { name: 'Archived 2' }))
      .toHaveAttribute('aria-current', 'page')
    await expect.element(page.getByText('No archived Campaigns.')).toBeVisible()
  })

  it('says there are no Campaigns yet when the Active view is empty', async () => {
    render(CampaignTable, props({ campaigns: [], activeCount: 0 }))

    await expect.element(page.getByText('No Campaigns yet.')).toBeVisible()
  })

  it('renders the actions snippet for each row', async () => {
    const actions = createRawSnippet((campaign: () => CampaignListItem) => ({
      render: () => `<span>act ${campaign().id}</span>`
    }))
    render(CampaignTable, props({ actions }))

    await expect.element(page.getByText('act c1')).toBeVisible()
  })

  it('links each World chip to the list filtered by that World', async () => {
    render(CampaignTable, props())

    await expect
      .element(page.getByRole('link', { name: 'Ashfall' }))
      .toHaveAttribute('href', '/campaigns?world=w1')
    // An archived World is still a valid filter, and stays struck through.
    await expect
      .element(page.getByRole('link', { name: 'Bramble' }))
      .toHaveAttribute('href', '/campaigns?world=w2')
    await expect.element(page.getByRole('link', { name: 'Bramble' })).toHaveClass(/line-through/)
  })

  it('keeps the archived view when a chip filters', async () => {
    render(CampaignTable, props({ view: 'archived' }))

    await expect
      .element(page.getByRole('link', { name: 'Ashfall' }))
      .toHaveAttribute('href', '/campaigns?view=archived&world=w1')
  })

  it('shows a banner naming the World filter with a Clear filter link', async () => {
    render(CampaignTable, props({ worldFilter: { id: 'w1', name: 'Ashfall' } }))

    await expect.element(page.getByText('Showing Campaigns set in Ashfall')).toBeVisible()
    await expect
      .element(page.getByRole('link', { name: 'Clear filter' }))
      .toHaveAttribute('href', '/campaigns')
    // The view toggle keeps the filter.
    await expect
      .element(page.getByRole('link', { name: 'Archived 2' }))
      .toHaveAttribute('href', '/campaigns?view=archived&world=w1')
  })

  it('says no Campaigns match when a filter leaves nothing', async () => {
    render(
      CampaignTable,
      props({ campaigns: [], activeCount: 0, worldFilter: { id: 'w1', name: 'Ashfall' } })
    )

    await expect.element(page.getByText('No Campaigns match.')).toBeVisible()
    await expect.element(page.getByText('No Campaigns yet.')).not.toBeInTheDocument()
  })

  it('marks a read-only Campaign and names the archived Worlds to restore', async () => {
    render(CampaignTable, props())

    const row = page.getByRole('row', { name: /Ember Road/ })
    await expect.element(row.getByText('Read-only', { exact: true })).toBeVisible()
    await expect.element(row.getByText('Restore Bramble to edit this Campaign.')).toBeVisible()
  })

  it('shows no read-only marks when every World is active', async () => {
    const calm = { ...ember, worlds: [{ id: 'w1', name: 'Ashfall', archived: false }] }
    render(CampaignTable, props({ campaigns: [calm] }))

    await expect.element(page.getByText('Read-only', { exact: true })).not.toBeInTheDocument()
  })
})
