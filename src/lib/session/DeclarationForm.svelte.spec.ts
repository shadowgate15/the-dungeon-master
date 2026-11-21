import { page } from 'vitest/browser'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-svelte'
import DeclarationForm from './DeclarationForm.svelte'

describe('DeclarationForm', () => {
  it('stays enabled while a Call is open, so typing something else is always possible', async () => {
    const onsend = vi.fn()
    render(DeclarationForm, { props: { callOpen: true, busy: false, onsend, onstop: () => {} } })

    const input = page.getByRole('textbox', { name: 'Your action' })
    await expect.element(input).toBeEnabled()
    await expect.element(input).toHaveAttribute('placeholder', 'Roll, or do something else.')
    await input.fill('I leave instead')
    await page.getByRole('button', { name: 'Send' }).click()
    expect(onsend).toHaveBeenCalledWith('I leave instead')
  })

  it('offers Stop instead of Send while an Exchange runs', async () => {
    const onstop = vi.fn()
    render(DeclarationForm, { props: { callOpen: false, busy: true, onsend: () => {}, onstop } })

    await expect.element(page.getByRole('textbox', { name: 'Your action' })).toBeDisabled()
    await page.getByRole('button', { name: 'Stop' }).click()
    expect(onstop).toHaveBeenCalledOnce()
  })
})
