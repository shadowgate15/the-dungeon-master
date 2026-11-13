import { page } from 'vitest/browser'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-svelte'
import type { JournalEntry } from '#lib/memory/journal.ts'
import JournalButton from './JournalButton.svelte'
import JournalOverlay from './JournalOverlay.svelte'

const entries: JournalEntry[] = [
  {
    id: 'n1',
    kind: 'npc',
    name: 'Grom',
    summary: 'A scarred gate warden.',
    role: 'warden',
    status: 'alive',
    stance: 'friendly',
    knows: ['The gate is cursed'],
    session: 1,
    chip: null
  },
  {
    id: 'f1',
    kind: 'fact',
    name: 'The gate is cursed',
    summary: 'Nobody crosses at night.',
    session: 1,
    chip: null
  },
  {
    id: 'n2',
    kind: 'npc',
    name: 'Mira',
    summary: 'A ferrywoman.',
    status: 'dead',
    session: 2,
    chip: { type: 'new' }
  },
  {
    id: 'p1',
    kind: 'place',
    name: 'Ash Gate',
    summary: 'A burnt gatehouse.',
    session: 2,
    chip: { type: 'updated', what: 'status' }
  }
]

describe('JournalButton', () => {
  it('shows just Journal when nothing is unseen', async () => {
    render(JournalButton, { unseen: 0, onclick: () => {} })

    await expect.element(page.getByRole('button', { name: 'Journal', exact: true })).toBeVisible()
  })

  it('carries the unseen count', async () => {
    render(JournalButton, { unseen: 3, onclick: () => {} })

    await expect.element(page.getByRole('button', { name: /Journal\s+·\s+3 new/ })).toBeVisible()
  })

  it('opens on click', async () => {
    const onclick = vi.fn()
    render(JournalButton, { unseen: 0, onclick })

    await page.getByRole('button', { name: 'Journal' }).click()

    expect(onclick).toHaveBeenCalledOnce()
  })
})

describe('JournalOverlay', () => {
  it('groups entries by Session, newest first', async () => {
    render(JournalOverlay, { entries, onclose: () => {} })

    const headings = page.getByRole('heading', { level: 3 })
    await expect.element(headings.nth(0)).toHaveTextContent('Session 2 · latest')
    await expect.element(headings.nth(1)).toHaveTextContent('Session 1')
  })

  it('shows an NPC with status, stance and what they know', async () => {
    render(JournalOverlay, { entries, onclose: () => {} })

    const section = page.getByRole('region', { name: 'Session 1' })
    await expect.element(section.getByText('Grom')).toBeVisible()
    await expect.element(section.getByText('A scarred gate warden.')).toBeVisible()
    await expect.element(section.getByText(/Person · warden · alive · friendly/)).toBeVisible()
    await expect.element(section.getByText('Knows: The gate is cursed')).toBeVisible()
  })

  it('shows New and Updated chips', async () => {
    render(JournalOverlay, { entries, onclose: () => {} })

    await expect.element(page.getByText('New', { exact: true })).toBeVisible()
    await expect.element(page.getByText('Updated: status')).toBeVisible()
  })

  it('filters by kind with counts in the index', async () => {
    render(JournalOverlay, { entries, onclose: () => {} })

    await expect.element(page.getByRole('button', { name: 'Everything (4)' })).toBeVisible()
    await expect.element(page.getByRole('button', { name: 'People (2)' })).toBeVisible()
    await expect.element(page.getByRole('button', { name: 'Places (1)' })).toBeVisible()
    await expect.element(page.getByRole('button', { name: 'Factions (0)' })).toBeVisible()

    await page.getByRole('button', { name: 'Facts (1)' }).click()

    await expect.element(page.getByText('Nobody crosses at night.')).toBeVisible()
    await expect.element(page.getByText('Mira')).not.toBeInTheDocument()
  })

  it('shows the blank page when there is nothing yet, and still closes', async () => {
    const onclose = vi.fn()
    render(JournalOverlay, { entries: [], onclose })

    await expect.element(page.getByText('A blank page.')).toBeVisible()
    await page.getByRole('button', { name: 'Close' }).click()

    expect(onclose).toHaveBeenCalledOnce()
  })
})
