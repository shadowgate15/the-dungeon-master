import { page } from 'vitest/browser'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import type { Journal as JournalData } from '#lib/memory/journal.ts'
import Journal from './Journal.svelte'
import Previously from './Previously.svelte'

const journal: JournalData = {
  people: [
    {
      sessionId: 's2',
      sessionNumber: 2,
      entries: [{ id: 'n2', name: 'Hob', role: 'Farmer', status: 'dead', stance: 'wary' }]
    },
    {
      sessionId: 's1',
      sessionNumber: 1,
      entries: [{ id: 'n1', name: 'Orla', role: 'Innkeeper', status: 'alive', stance: 'friendly' }]
    }
  ],
  places: [
    {
      sessionId: 's1',
      sessionNumber: 1,
      entries: [{ id: 'p1', name: 'The Gilded Stag', description: 'A tavern.' }]
    }
  ],
  facts: []
}

describe('Journal', () => {
  it('lists People by Session, newest first, with role, status and stance', async () => {
    render(Journal, { journal })

    const groups = page.getByRole('heading', { level: 3 })
    await expect.element(groups.nth(0)).toHaveTextContent('Session 2')
    await expect.element(groups.nth(1)).toHaveTextContent('Session 1')
    await expect.element(page.getByText('Orla')).toBeVisible()
    await expect.element(page.getByText('Innkeeper')).toBeVisible()
    await expect.element(page.getByText('friendly')).toBeVisible()
    await expect.element(page.getByText('dead')).toBeVisible()
  })

  it('switches kind through the index and says when a kind is empty', async () => {
    render(Journal, { journal })

    await page.getByRole('tab', { name: 'Places' }).click()
    await expect.element(page.getByText('The Gilded Stag')).toBeVisible()
    await expect.element(page.getByText('Orla')).not.toBeInTheDocument()

    await page.getByRole('tab', { name: 'Facts' }).click()
    await expect.element(page.getByText('Nothing here yet.')).toBeVisible()
  })

  it('shows no Knows lines', async () => {
    render(Journal, { journal })
    await expect.element(page.getByText(/knows/i)).not.toBeInTheDocument()
  })
})

describe('Previously', () => {
  it('shows the recap text under a Previously heading', async () => {
    render(Previously, { recap: { source: 'summary', sessionId: 's1', text: 'The party fled.' } })

    await expect.element(page.getByRole('heading', { name: 'Previously' })).toBeVisible()
    await expect.element(page.getByText('The party fled.')).toBeVisible()
  })
})
