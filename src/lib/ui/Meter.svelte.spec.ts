import { page } from 'vitest/browser'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import Meter from './Meter.svelte'

describe('Meter', () => {
  it('exposes value, min and max', async () => {
    render(Meter, { label: 'Context', used: 25, limit: 100 })

    const meter = page.getByRole('meter', { name: 'Context' })
    await expect.element(meter).toHaveAttribute('aria-valuenow', '25')
    await expect.element(meter).toHaveAttribute('aria-valuemin', '0')
    await expect.element(meter).toHaveAttribute('aria-valuemax', '100')
  })

  it('clamps used above the limit', async () => {
    render(Meter, { label: 'Context', used: 150, limit: 100 })

    await expect
      .element(page.getByRole('meter', { name: 'Context' }))
      .toHaveAttribute('aria-valuenow', '100')
  })

  it('clamps negative used to zero', async () => {
    render(Meter, { label: 'Context', used: -5, limit: 100 })

    await expect
      .element(page.getByRole('meter', { name: 'Context' }))
      .toHaveAttribute('aria-valuenow', '0')
  })
})
