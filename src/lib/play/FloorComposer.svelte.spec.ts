import { page, userEvent } from 'vitest/browser'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { declarations } from './play-fixtures'
import FloorComposer from './FloorComposer.svelte'

const handlers = () => ({ onsend: vi.fn(), onedit: vi.fn(), onwithdraw: vi.fn() })

describe('FloorComposer', () => {
  it('lists the pending Declarations with the Character each names', async () => {
    render(FloorComposer, { acting: 'Wren', declarations, ...handlers() })

    const tray = page.getByRole('list', { name: 'Pending Declarations' })
    await expect
      .element(tray.getByRole('listitem').nth(0))
      .toHaveTextContent(/Wren\s*I keep my back/)
    await expect
      .element(tray.getByRole('listitem').nth(1))
      .toHaveTextContent(/Bram\s*I bar the door/)
  })

  it('sends a Declaration for the acting Character and clears the box', async () => {
    const h = handlers()
    render(FloorComposer, { acting: 'Wren', declarations: [], ...h })

    const box = page.getByRole('textbox', { name: 'What does Wren do?' })
    await box.fill('  I pick the lock.  ')
    await page.getByRole('button', { name: 'Send' }).click()

    expect(h.onsend).toHaveBeenCalledWith('I pick the lock.')
    await expect.element(box).toHaveValue('')
  })

  it('sends on Enter and keeps Shift+Enter for a new line', async () => {
    const h = handlers()
    render(FloorComposer, { acting: 'Wren', declarations: [], ...h })

    const box = page.getByRole('textbox', { name: 'What does Wren do?' })
    await box.click()
    await userEvent.keyboard('I listen{Shift>}{Enter}{/Shift}closely{Enter}')

    expect(h.onsend).toHaveBeenCalledWith('I listen\nclosely')
  })

  it('does not send an empty Declaration', async () => {
    const h = handlers()
    render(FloorComposer, { acting: 'Wren', declarations: [], ...h })

    await expect.element(page.getByRole('button', { name: 'Send' })).toBeDisabled()
  })

  it('edits a pending Declaration', async () => {
    const h = handlers()
    render(FloorComposer, { acting: 'Wren', declarations, ...h })

    await page.getByRole('button', { name: 'Edit Wren: I keep my back to the stairs.' }).click()
    const edit = page.getByRole('textbox', { name: 'Edit Declaration' })
    await edit.fill('I keep my back to the wall.')
    await page.getByRole('button', { name: 'Save' }).click()

    expect(h.onedit).toHaveBeenCalledWith('d1', 'I keep my back to the wall.')
  })

  it('withdraws a pending Declaration', async () => {
    const h = handlers()
    render(FloorComposer, { acting: 'Wren', declarations, ...h })

    await page.getByRole('button', { name: 'Withdraw Bram: I bar the door.' }).click()

    expect(h.onwithdraw).toHaveBeenCalledWith('d2')
  })

  it('cannot send with no acting Character', async () => {
    render(FloorComposer, { acting: null, declarations: [], ...handlers() })

    await expect.element(page.getByRole('textbox')).toBeDisabled()
  })
})
