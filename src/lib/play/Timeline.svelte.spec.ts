import { page, userEvent } from 'vitest/browser'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
// The real layout, so a long story overflows the Timeline and it scrolls.
import '../../routes/layout.css'
import { attackRollEntries, rollEntries, timelineEntries } from './play-fixtures'
import type { TimelineEntry } from './timeline'
import Timeline from './Timeline.svelte'

const narrations = (count: number): TimelineEntry[] =>
  Array.from({ length: count }, (_, i) => ({
    type: 'narration',
    id: `n${i}`,
    text: `Narration ${i}: the corridor stretches on into the dark.`,
    voice: null
  }))

/** A short console, so a long story overflows the Timeline. */
function shortConsole() {
  const box = document.createElement('div')
  box.style.cssText = 'display: flex; flex-direction: column; height: 240px'
  document.body.append(box)
  return box
}

const timeline = page.getByRole('list', { name: 'Timeline' })
const timelineList = () => timeline.element() as HTMLElement
const distanceFromBottom = () => {
  const list = timelineList()
  return list.scrollHeight - list.clientHeight - list.scrollTop
}

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

  it('shows each roll as one line: who, what, the dice, the total and the outcome', async () => {
    render(Timeline, { entries: rollEntries, awaitingSince: null })

    const items = page.getByRole('list', { name: 'Timeline' }).getByRole('listitem')
    await expect
      .element(items.nth(0))
      .toHaveTextContent(/Wren\s*Sleight of Hand check\s*🎲 14 \+ 5\s*= 19\s*success/)
    await expect
      .element(items.nth(1))
      .toHaveTextContent(
        /Bram\s*Perception check\s*🎲 4 \| 17 − 1\s*= 16\s*failure\s*\(advantage: Bram knows these streets\)/
      )
    await expect.element(items.nth(2)).toHaveTextContent(/Which door\?\s*Left/)
  })

  it('hides rolls with the Rolls filter', async () => {
    render(Timeline, { entries: rollEntries, awaitingSince: null })

    await page.getByRole('checkbox', { name: 'Rolls' }).click()
    await expect.poll(() => page.getByRole('listitem').elements().length).toBe(1)
  })

  it('ends the progress bar with "The DM left mid-turn" when the DM is away', async () => {
    render(Timeline, { entries: [], awaitingSince: Date.now() - 5000, away: true })

    await expect.element(page.getByText(/The DM left mid-turn/)).toBeVisible()
    await expect.element(page.getByRole('progressbar')).not.toBeInTheDocument()
  })

  it("shows an attack's hit or miss, and the target's state after damage, never its HP", async () => {
    render(Timeline, { entries: attackRollEntries, awaitingSince: null })

    const items = page.getByRole('list', { name: 'Timeline' }).getByRole('listitem')
    await expect
      .element(items.nth(0))
      .toHaveTextContent(/Crossbow, light attack\s*🎲 15 \+ 4\s*= 19\s*hit/)
    await expect
      .element(items.nth(1))
      .toHaveTextContent(/Crossbow, light damage\s*🎲 3 \+ 2\s*= 5\s*Grik is bloodied/)
    await expect
      .element(items.nth(2))
      .toHaveTextContent(/Grik\s*Scimitar attack\s*🎲 2 \+ 4\s*= 6\s*miss/)
  })

  describe('following the latest entry', () => {
    it('opens at the latest entry when the story loads', async () => {
      const screen = render(Timeline, {
        target: shortConsole(),
        props: { entries: [], awaitingSince: null }
      })
      await screen.rerender({ entries: narrations(40) })

      await expect.poll(distanceFromBottom).toBeLessThanOrEqual(1)
      expect(timelineList().scrollTop).toBeGreaterThan(0)
    })

    it('stays at the latest entry when a new one arrives', async () => {
      const screen = render(Timeline, {
        target: shortConsole(),
        props: { entries: narrations(40), awaitingSince: null }
      })
      await expect.poll(distanceFromBottom).toBeLessThanOrEqual(1)

      await screen.rerender({ entries: narrations(45) })

      await expect.element(page.getByText(/^Narration 44:/)).toBeInTheDocument()
      await expect.poll(distanceFromBottom).toBeLessThanOrEqual(1)
    })

    it('holds its place when the Player has scrolled up to reread', async () => {
      const screen = render(Timeline, {
        target: shortConsole(),
        props: { entries: narrations(40), awaitingSince: null }
      })
      await expect.poll(distanceFromBottom).toBeLessThanOrEqual(1)

      await userEvent.wheel(timeline, { delta: { y: -400 } })
      await expect.poll(distanceFromBottom).toBeGreaterThan(300)
      const reading = timelineList().scrollTop
      await screen.rerender({ entries: narrations(45) })

      await expect.element(page.getByText(/^Narration 44:/)).toBeInTheDocument()
      expect(timelineList().scrollTop).toBe(reading)
    })

    it('follows again once a Show filter leaves the Player at the bottom', async () => {
      const screen = render(Timeline, {
        target: shortConsole(),
        props: { entries: narrations(40), awaitingSince: null }
      })
      await expect.poll(distanceFromBottom).toBeLessThanOrEqual(1)
      await userEvent.wheel(timeline, { delta: { y: -400 } })
      await expect.poll(distanceFromBottom).toBeGreaterThan(300)

      await page.getByRole('checkbox', { name: 'Story' }).click()
      await expect.element(page.getByText(/^Narration 39:/)).not.toBeInTheDocument()
      await page.getByRole('checkbox', { name: 'Story' }).click()
      await screen.rerender({ entries: narrations(45) })

      await expect.element(page.getByText(/^Narration 44:/)).toBeInTheDocument()
      await expect.poll(distanceFromBottom).toBeLessThanOrEqual(1)
    })
  })
})
