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

  describe('while a question is open', () => {
    const props = () => ({
      callOpen: true,
      question: true,
      busy: false,
      onsend: vi.fn(),
      onanswer: vi.fn(),
      onstop: () => {}
    })

    it('answers the question with what is typed, by default', async () => {
      const p = props()
      render(DeclarationForm, { props: p })

      const input = page.getByRole('textbox', { name: 'Your action' })
      await expect.element(input).toHaveAttribute('placeholder', 'Answer, or do something else.')
      await input.fill('The one on the left')
      await page.getByRole('button', { name: 'Answer' }).click()
      expect(p.onanswer).toHaveBeenCalledWith('The one on the left')
      expect(p.onsend).not.toHaveBeenCalled()
    })

    it('withdraws it instead with "Do something else", sending a new Declaration', async () => {
      const p = props()
      render(DeclarationForm, { props: p })

      await page.getByRole('textbox', { name: 'Your action' }).fill('I leave the tavern')
      await page.getByRole('button', { name: 'Do something else' }).click()
      expect(p.onsend).toHaveBeenCalledWith('I leave the tavern')
      expect(p.onanswer).not.toHaveBeenCalled()
    })
  })

  it('offers Stop instead of Send while an Exchange runs', async () => {
    const onstop = vi.fn()
    render(DeclarationForm, { props: { callOpen: false, busy: true, onsend: () => {}, onstop } })

    await expect.element(page.getByRole('textbox', { name: 'Your action' })).toBeDisabled()
    await page.getByRole('button', { name: 'Stop' }).click()
    expect(onstop).toHaveBeenCalledOnce()
  })
})
