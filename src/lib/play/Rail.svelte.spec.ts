import { page } from 'vitest/browser'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { journalEntries } from './play-fixtures'
import Rail from './Rail.svelte'
import type { SceneView } from './scene'

const scene: SceneView = {
  clock: { minute: 0, day: 1, time: '08:00' },
  place: { name: 'Ruined Chapel' },
  present: [{ id: 'wren', name: 'Wren' }],
  elsewhere: [{ id: 'kael', name: 'Kael', whereabouts: 'the cellar' }]
}

describe('Rail Journal card', () => {
  it('follows the viewed Character, even one who is elsewhere', async () => {
    render(Rail, {
      scene,
      journal: { entries: journalEntries },
      viewer: { id: 'kael', name: 'Kael' }
    })

    await expect.element(page.getByRole('heading', { name: 'What Kael knows' })).toBeVisible()
    const items = page.getByRole('region', { name: 'Mira Voss' }).getByRole('listitem')
    // Kael's own entry comes first and is unmarked
    await expect.element(items.nth(0)).toHaveTextContent(/Mira owes the harbourmaster money/)
    await expect.element(items.nth(0)).not.toHaveTextContent(/Wren, Kael/)
  })

  it('never falls back to "the Party"', async () => {
    render(Rail, {
      scene,
      journal: { entries: journalEntries },
      viewer: { id: 'wren', name: 'Wren' }
    })

    await expect.element(page.getByText(/the Party/)).not.toBeInTheDocument()
  })
})
