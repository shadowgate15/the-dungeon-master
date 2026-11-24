import { page } from 'vitest/browser'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { timelineEntries } from './play-fixtures'
import Timeline from './Timeline.svelte'

describe('Timeline', () => {
  it('says the story has not started when nothing has happened', async () => {
    render(Timeline, { entries: [], awaitingSince: null })

    await expect.element(page.getByText('Nothing has happened yet.')).toBeVisible()
  })

  it('shows Declarations, Narrations with their NPC voice, and muted DM activity', async () => {
    render(Timeline, { entries: timelineEntries, awaitingSince: null })

    const items = page.getByRole('list', { name: 'Timeline' }).getByRole('listitem')
    await expect.element(items.nth(0)).toHaveTextContent(/Wren\s*I pick the lock\./)
    await expect.element(items.nth(1)).toHaveTextContent('⚙ DM checks their notes')
    await expect.element(items.nth(2)).toHaveTextContent('The lock clicks open.')
    await expect.element(items.nth(3)).toHaveTextContent(/Mira Voss\s*"You are late," she says\./)
  })

  it('hides DM activity, or the story, with the Show filters', async () => {
    render(Timeline, { entries: timelineEntries, awaitingSince: null })
    const items = page.getByRole('list', { name: 'Timeline' }).getByRole('listitem')

    await page.getByRole('checkbox', { name: 'DM activity' }).click()
    await expect.element(page.getByText('⚙ DM checks their notes')).not.toBeInTheDocument()
    await expect.poll(() => items.elements().length).toBe(3)

    await page.getByRole('checkbox', { name: 'Story' }).click()
    await expect.poll(() => items.elements().length).toBe(0)
  })

  it('marks the recap Narration "Previously"', async () => {
    render(Timeline, {
      entries: [
        {
          type: 'narration',
          id: 'e1',
          text: 'The ledger is in your hands.',
          voice: null,
          recap: true
        }
      ],
      awaitingSince: null
    })

    const item = page.getByRole('list', { name: 'Timeline' }).getByRole('listitem').nth(0)
    await expect.element(item).toHaveTextContent(/Previously\s*The ledger is in your hands\./)
  })

  it('shows a turn that went wrong as an alert', async () => {
    render(Timeline, {
      entries: [{ type: 'error', id: 'e9', text: 'The DM ended its turn without a Narration.' }],
      awaitingSince: null
    })

    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('The DM ended its turn without a Narration.')
  })

  it('shows the DM working on the turn as Ns / ~20s', async () => {
    render(Timeline, { entries: [], awaitingSince: Date.now() - 5_000 })

    const bar = page.getByRole('progressbar', { name: 'The DM is working' })
    await expect.element(bar).toBeInTheDocument()
    await expect.element(bar).toHaveAttribute('aria-valuemax', '20')
    await expect.element(page.getByText(/^[56]s \/ ~20s$/)).toBeVisible()
  })

  it('shows no progress bar when nothing awaits Narration', async () => {
    render(Timeline, { entries: timelineEntries, awaitingSince: null })

    await expect.element(page.getByRole('progressbar')).not.toBeInTheDocument()
  })
})
