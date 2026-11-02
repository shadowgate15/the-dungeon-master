import { page } from 'vitest/browser'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import ContextMeter from './ContextMeter.svelte'

describe('ContextMeter', () => {
  it('shows used against the limit', async () => {
    render(ContextMeter, { used: 1024, limit: 4096 })

    await expect
      .element(page.getByRole('meter', { name: 'Context' }))
      .toHaveAttribute('aria-valuenow', '1024')
    await expect.element(page.getByText('1,024 / 4,096 tokens')).toBeVisible()
    await expect.element(page.getByText(/almost full/i)).not.toBeInTheDocument()
  })

  it('marks an estimate with a tilde', async () => {
    render(ContextMeter, { used: 500, limit: 4096, estimated: true })

    await expect.element(page.getByText('~500 / 4,096 tokens')).toBeVisible()
  })

  it('warns at 80% of the limit', async () => {
    render(ContextMeter, { used: 3400, limit: 4096 })

    await expect.element(page.getByText(/almost full/i)).toBeVisible()
  })
})
