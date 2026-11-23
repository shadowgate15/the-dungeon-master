import { page } from 'vitest/browser'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import CreationStepper from './CreationStepper.svelte'

describe('CreationStepper', () => {
  it('links the available steps and marks the current one', async () => {
    render(CreationStepper, {
      current: 'Party',
      hrefs: { Seed: '/campaigns/c1', Party: '/campaigns/c1/party' },
      unavailable: ['Begin']
    })

    await expect
      .element(page.getByRole('link', { name: /Seed/ }))
      .toHaveAttribute('href', '/campaigns/c1')
    await expect
      .element(page.getByRole('link', { name: /Party/ }))
      .toHaveAttribute('aria-current', 'step')
    await expect.element(page.getByRole('link', { name: /Begin/ })).not.toBeInTheDocument()
    await expect.element(page.getByText(/Begin/)).toHaveTextContent(/not available yet/)
  })
})
