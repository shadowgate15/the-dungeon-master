import { page } from 'vitest/browser'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { createRawSnippet } from 'svelte'
import Dialog from './Dialog.svelte'

const body = createRawSnippet(() => ({ render: () => '<p>Dialog body</p>' }))

describe('Dialog', () => {
  it('is named by its title', async () => {
    render(Dialog, { open: true, title: 'New World', closeHref: '/', children: body })

    await expect.element(page.getByRole('dialog', { name: 'New World' })).toBeVisible()
  })

  it('offers a real close link that works without JavaScript', async () => {
    render(Dialog, { open: true, title: 'New World', closeHref: '/worlds', children: body })

    await expect
      .element(page.getByRole('link', { name: 'Close' }))
      .toHaveAttribute('href', '/worlds')
  })

  it('upgrades a server-rendered open dialog to a modal', async () => {
    render(Dialog, { open: true, title: 'New World', closeHref: '/', children: body })

    const dialog = page.getByRole('dialog', { name: 'New World' }).element()
    expect(dialog.matches(':modal')).toBe(true)
  })

  it('opens as a modal when opened after mount', async () => {
    const { rerender } = render(Dialog, {
      open: false,
      title: 'New World',
      closeHref: '/',
      children: body
    })

    await rerender({ open: true })

    const dialog = page.getByRole('dialog', { name: 'New World' }).element()
    expect(dialog.matches(':modal')).toBe(true)
  })

  it('closes and reports it when the close link is clicked', async () => {
    let closed = 0
    render(Dialog, {
      open: true,
      title: 'New World',
      closeHref: '/',
      onclose: () => closed++,
      children: body
    })

    await page.getByRole('link', { name: 'Close' }).click()

    await expect.element(page.getByRole('dialog')).not.toBeInTheDocument()
    expect(closed).toBe(1)
  })
})
