import { page } from 'vitest/browser'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-svelte'
import TableStrip from './TableStrip.svelte'
import type { TableBrowser } from './floor'

const wren = { id: 'c-wren', name: 'Wren' }
const bram = { id: 'c-bram', name: 'Bram' }
const kael = { id: 'c-kael', name: 'Kael' }
const tamsin = { id: 'c-tamsin', name: 'Tamsin' }

const browsers: TableBrowser[] = [
  { own: true, characters: [wren], done: false },
  { own: false, characters: [bram, kael], done: true }
]

const handlers = () => ({ onundone: vi.fn(), onrelease: vi.fn() })

describe('TableStrip', () => {
  it('names each browser by its in-Scene Characters and marks deciding or Done', async () => {
    render(TableStrip, { browsers, unclaimed: [], isHost: false, ...handlers() })

    const strip = page.getByRole('list', { name: 'The table' })
    await expect
      .element(strip.getByRole('listitem').nth(0))
      .toHaveTextContent(/You \(Wren\).*deciding/)
    await expect
      .element(strip.getByRole('listitem').nth(1))
      .toHaveTextContent(/Bram & Kael.*Done ✓/)
  })

  it('shows an unclaimed Character as sitting out', async () => {
    render(TableStrip, { browsers, unclaimed: [tamsin], isHost: false, ...handlers() })
    await expect.element(page.getByText('Tamsin · unclaimed, sits out')).toBeVisible()
  })

  it('offers Not done yet on your own chip only while Done', async () => {
    const h = handlers()
    const { rerender } = render(TableStrip, { browsers, unclaimed: [], isHost: false, ...h })
    await expect.element(page.getByRole('button', { name: 'Not done yet' })).not.toBeInTheDocument()

    await rerender({ browsers: [{ ...browsers[0], done: true }, browsers[1]] })
    await page.getByRole('button', { name: 'Not done yet' }).click()
    expect(h.onundone).toHaveBeenCalled()
  })

  it('gives the Host Release per Character on other browsers, never on its own chip', async () => {
    const h = handlers()
    render(TableStrip, { browsers, unclaimed: [], isHost: true, ...h })

    await expect.element(page.getByRole('button', { name: 'Release Wren' })).not.toBeInTheDocument()
    await page.getByRole('button', { name: 'Release Kael' }).click()
    expect(h.onrelease).toHaveBeenCalledWith('c-kael')
    await expect.element(page.getByRole('button', { name: 'Release Bram' })).toBeVisible()
  })

  it('shows no Release to a Player who is not the Host', async () => {
    render(TableStrip, { browsers, unclaimed: [], isHost: false, ...handlers() })
    await expect.element(page.getByRole('button', { name: /Release/ })).not.toBeInTheDocument()
  })
})
