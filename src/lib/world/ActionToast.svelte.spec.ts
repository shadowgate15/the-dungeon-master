import { page, userEvent } from 'vitest/browser'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import ActionToast from './ActionToast.svelte'

describe('ActionToast', () => {
  it('renders nothing without a notice', async () => {
    render(ActionToast, { notice: undefined })

    await expect.element(page.getByRole('status')).not.toBeInTheDocument()
  })

  it('shows the message with no Undo when the action cannot be undone', async () => {
    render(ActionToast, { notice: { message: 'Deleted Eldoria' } })

    await expect.element(page.getByRole('status')).toHaveTextContent('Deleted Eldoria')
    await expect.element(page.getByRole('button', { name: 'Undo' })).not.toBeInTheDocument()
  })

  it('posts the reverse action for every affected World when Undo is used', async () => {
    render(ActionToast, {
      notice: { message: 'Archived 2 Worlds', undo: { action: 'restore', ids: ['w1', 'w2'] } }
    })

    const form = page.getByRole('button', { name: 'Undo' }).element().closest('form')!
    expect(form.getAttribute('action')).toBe('?/restore')
    expect(form.method).toBe('post')
    expect(new FormData(form).getAll('id')).toEqual(['w1', 'w2'])
  })

  it('keeps the Archived view when Undo is used from it', async () => {
    render(ActionToast, {
      view: 'archived',
      notice: { message: 'Restored Eldoria', undo: { action: 'archive', ids: ['w1'] } }
    })

    const form = page.getByRole('button', { name: 'Undo' }).element().closest('form')!
    expect(form.getAttribute('action')).toBe('?/archive&view=archived')
  })

  it('can be dismissed, and a newer notice shows again', async () => {
    const { rerender } = render(ActionToast, { notice: { message: 'Archived Eldoria' } })

    await userEvent.click(page.getByRole('button', { name: 'Dismiss' }))
    await expect.element(page.getByRole('status')).not.toBeInTheDocument()

    await rerender({ notice: { message: 'Restored Eldoria' } })
    await expect.element(page.getByRole('status')).toHaveTextContent('Restored Eldoria')
  })
})
