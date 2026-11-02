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
    await expect.element(row.getByText('Ashfall')).toBeVisible()
    await expect.element(row.getByText('Bramble')).toBeVisible()
    await expect.element(row.getByText('2026-11-02')).toBeVisible()
  })

  it('strikes through archived Worlds', async () => {
    render(CampaignTable, props())

    await expect.element(page.getByText('Bramble')).toHaveClass(/line-through/)
    await expect.element(page.getByText('Ashfall')).not.toHaveClass(/line-through/)
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
})
