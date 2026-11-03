import { page } from 'vitest/browser'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { createRawSnippet } from 'svelte'
import Toast from './Toast.svelte'

const text = createRawSnippet(() => ({ render: () => '<span>World archived</span>' }))

describe('Toast', () => {
  it('is announced as a status', async () => {
    render(Toast, { children: text })

    await expect.element(page.getByRole('status')).toHaveTextContent('World archived')
  })

  it('reports dismissal through onclose', async () => {
    let closed = 0
    render(Toast, { onclose: () => closed++, children: text })

    await page.getByRole('button', { name: 'Dismiss' }).click()

    expect(closed).toBe(1)
  })

  it('has no dismiss button without onclose', async () => {
    render(Toast, { children: text })

    await expect.element(page.getByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument()
  })
})
