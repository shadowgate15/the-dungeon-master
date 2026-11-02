import { page } from 'vitest/browser'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { createRawSnippet } from 'svelte'
import Alert from './Alert.svelte'

const text = createRawSnippet(() => ({ render: () => '<span>Something happened</span>' }))

describe('Alert', () => {
  it('announces danger as an alert', async () => {
    render(Alert, { variant: 'danger', children: text })

    await expect.element(page.getByRole('alert')).toHaveTextContent('Something happened')
  })

  it('announces warning as an alert', async () => {
    render(Alert, { variant: 'warning', children: text })

    await expect.element(page.getByRole('alert')).toBeVisible()
  })

  it('announces info politely as a status', async () => {
    render(Alert, { variant: 'info', children: text })

    await expect.element(page.getByRole('status')).toHaveTextContent('Something happened')
    await expect.element(page.getByRole('alert')).not.toBeInTheDocument()
  })

  it('announces success politely as a status', async () => {
    render(Alert, { variant: 'success', children: text })

    await expect.element(page.getByRole('status')).toBeVisible()
  })
})
