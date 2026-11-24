import { page } from 'vitest/browser'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { sessionSummaries } from './play-fixtures'
import SessionHistory from './SessionHistory.svelte'

describe('SessionHistory', () => {
  it('says no Session has closed yet when there are none', async () => {
    render(SessionHistory, { sessions: [] })

    await expect.element(page.getByText('No Session has closed yet.')).toBeVisible()
  })

  it("shows each Session's number, real date, in-fiction span, summary and threads", async () => {
    render(SessionHistory, { sessions: sessionSummaries })

    const second = page.getByRole('article', { name: 'Session 2' })
    await expect.element(second).toHaveTextContent(/21 Nov 2026/)
    await expect.element(second).toHaveTextContent(/day 2, 18:00 – day 2, 21:00/)
    await expect.element(second).toHaveTextContent(/sails for the Isles at dawn/)
    await expect
      .element(second.getByRole('listitem').nth(1))
      .toHaveTextContent('Who signed the ledger?')
    const first = page.getByRole('article', { name: 'Session 1' })
    await expect.element(first).toHaveTextContent(/day 1, 08:00/)
    await expect.element(first.getByRole('list')).not.toBeInTheDocument()
  })

  it('offers no way to edit a summary', async () => {
    render(SessionHistory, { sessions: sessionSummaries })

    await expect.element(page.getByRole('button')).not.toBeInTheDocument()
    await expect.element(page.getByRole('textbox')).not.toBeInTheDocument()
  })
})
