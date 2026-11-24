import { page, userEvent } from 'vitest/browser'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { declarations } from './play-fixtures'
import FloorComposer from './FloorComposer.svelte'

const handlers = () => ({
  onsend: vi.fn(),
  ondone: vi.fn(),
  onedit: vi.fn(),
  onwithdraw: vi.fn()
})

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

  it('closes the Floor with Done', async () => {
    const h = handlers()
    render(FloorComposer, { acting: 'Wren', declarations, ...h })

    await page.getByRole('button', { name: 'Done' }).click()

    expect(h.ondone).toHaveBeenCalledWith(null)
  })

  it('offers Done on an empty Floor, to hand the DM the initiative', async () => {
    const h = handlers()
    render(FloorComposer, { acting: 'Wren', declarations: [], ...h })

    await page.getByRole('button', { name: 'Done' }).click()

    expect(h.ondone).toHaveBeenCalledWith(null)
  })

  it('sends and closes the Floor on Ctrl+Enter', async () => {
    const h = handlers()
    render(FloorComposer, { acting: 'Wren', declarations: [], ...h })

    await page.getByRole('textbox', { name: 'What does Wren do?' }).click()
    await userEvent.keyboard('I pick the lock.{Control>}{Enter}{/Control}')

    expect(h.ondone).toHaveBeenCalledWith('I pick the lock.')
    expect(h.onsend).not.toHaveBeenCalled()
    await expect.element(page.getByRole('textbox', { name: 'What does Wren do?' })).toHaveValue('')
  })

  it('keeps drafting open but holds Done while the DM is answering', async () => {
    const h = handlers()
    render(FloorComposer, { acting: 'Wren', declarations: [], awaiting: true, ...h })

    await expect.element(page.getByRole('button', { name: 'Done' })).toBeDisabled()
    const box = page.getByRole('textbox', { name: 'What does Wren do?' })
    await box.fill('I wait.')
    await page.getByRole('button', { name: 'Send' }).click()
    expect(h.onsend).toHaveBeenCalledWith('I wait.')
  })
})

describe('FloorComposer for a split Party', () => {
  it('greys out Characters elsewhere and asks the DM to cut to one', async () => {
    const oncut = vi.fn()
    render(FloorComposer, {
      acting: 'Wren',
      declarations: [],
      elsewhere: [{ id: 'c-bram', name: 'Bram', whereabouts: 'The Docks' }],
      oncut,
      ...handlers()
    })

    await expect.element(page.getByText('Bram · elsewhere: The Docks')).toBeVisible()
    await page.getByRole('button', { name: 'Cut to Bram' }).click()

    expect(oncut).toHaveBeenCalledWith('c-bram')
  })

  it('loads drafts a cut sent back into the box as unsent text', async () => {
    const onreturned = vi.fn()
    render(FloorComposer, {
      acting: 'Bram',
      declarations: [],
      returned: [
        { id: 'r1', character: 'c-wren', characterName: 'Wren', text: 'I check the cellar door.' }
      ],
      onreturned,
      ...handlers()
    })

    await expect
      .element(page.getByRole('textbox', { name: 'What does Bram do?' }))
      .toHaveValue('I check the cellar door.')
    expect(onreturned).toHaveBeenCalledWith(['r1'])
  })

  it('says the composer is locked to the Character whose turn it is', async () => {
    render(FloorComposer, { acting: 'Wren', turn: 'Wren', declarations: [], ...handlers() })

    await expect.element(page.getByText("Wren's turn")).toBeVisible()
    await expect.element(page.getByRole('textbox', { name: 'What does Wren do?' })).toBeEnabled()
  })

  it("blocks the box on a foe's turn", async () => {
    render(FloorComposer, { acting: null, turn: 'Goblin 1', declarations: [], ...handlers() })

    const box = page.getByRole('textbox', { name: "It is Goblin 1's turn" })
    await expect.element(box).toBeDisabled()
    await expect.element(page.getByRole('button', { name: 'Send' })).toBeDisabled()
  })
})
