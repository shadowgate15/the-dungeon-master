import { page } from 'vitest/browser'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { journalEntries } from './play-fixtures'
import Journal from './Journal.svelte'

describe('Journal', () => {
  it('says nothing is known yet when the Characters believe nothing', async () => {
    render(Journal, { entries: [] })

    await expect.element(page.getByText('Nothing learned yet.')).toBeVisible()
  })

  it('groups what the Characters believe by what it is about, marked with who holds it', async () => {
    render(Journal, { entries: journalEntries })

    const mira = page.getByRole('region', { name: 'Mira Voss' })
    const items = mira.getByRole('listitem')
    await expect.element(items.nth(0)).toHaveTextContent(/Mira owes the harbourmaster money/)
    await expect.element(items.nth(0)).toHaveTextContent(/Wren, Kael/)
    await expect.element(items.nth(1)).toHaveTextContent(/Mira sailed for the Isles/)
    await expect.element(items.nth(1)).toHaveTextContent(/from a dockhand/)
    await expect.element(page.getByRole('region', { name: 'Saltgate' })).toHaveTextContent(/Place/)
  })

  it("marks only the Party's entries in one Character's view, not their own", async () => {
    render(Journal, { entries: journalEntries, actor: 'kael' })

    const mira = page.getByRole('region', { name: 'Mira Voss' })
    const items = mira.getByRole('listitem')
    await expect.element(items.nth(0)).toHaveTextContent(/Mira owes the harbourmaster money/)
    await expect.element(items.nth(0)).not.toHaveTextContent(/Wren, Kael/)
    await expect.element(items.nth(1)).toHaveTextContent(/Mira sailed for the Isles/)
    await expect.element(items.nth(1)).toHaveTextContent(/Wren/)
  })
})

describe('Journal (full page)', () => {
  it('marks each entry with its Holders when no one is viewing', async () => {
    render(Journal, { entries: journalEntries })

    const items = page.getByRole('region', { name: 'Mira Voss' }).getByRole('listitem')
    await expect.element(items.nth(1)).toHaveTextContent(/Wren/)
    await expect.element(items.nth(0)).toHaveTextContent(/Wren, Kael/)
  })
})
