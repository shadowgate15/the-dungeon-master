import { page, userEvent } from 'vitest/browser'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import WorldPicker from './WorldPicker.svelte'

const worlds = [
  { id: 'w1', name: 'Ashfall' },
  { id: 'w2', name: 'Bramble' },
  { id: 'w3', name: 'Cinder' }
]

const addSelect = () => page.getByRole('combobox', { name: 'Add World' })

describe('WorldPicker', () => {
  it('shows each chosen World as a chip and offers only the unchosen ones', async () => {
    render(WorldPicker, { worlds, value: ['w1', 'w2'] })

    await expect.element(page.getByText('Ashfall')).toBeVisible()
    await expect.element(page.getByText('Bramble')).toBeVisible()
    await expect.element(addSelect().getByRole('option', { name: 'Cinder' })).toBeInTheDocument()
    await expect
      .element(addSelect().getByRole('option', { name: 'Ashfall' }))
      .not.toBeInTheDocument()
    await expect
      .element(addSelect().getByRole('option', { name: 'Bramble' }))
      .not.toBeInTheDocument()
  })

  it('adds a World from the select as a new chip and stops offering it', async () => {
    render(WorldPicker, { worlds, value: ['w1'] })

    await userEvent.selectOptions(addSelect(), 'Bramble')

    await expect.element(page.getByRole('button', { name: 'Remove Bramble' })).toBeVisible()
    await expect
      .element(addSelect().getByRole('option', { name: 'Bramble' }))
      .not.toBeInTheDocument()
  })

  it('removes a chip and offers its World again', async () => {
    render(WorldPicker, { worlds, value: ['w1', 'w2'] })

    await userEvent.click(page.getByRole('button', { name: 'Remove Bramble' }))

    await expect
      .element(page.getByRole('button', { name: 'Remove Bramble' }))
      .not.toBeInTheDocument()
    await expect.element(addSelect().getByRole('option', { name: 'Bramble' })).toBeInTheDocument()
  })

  it('locks the last chip with a hint', async () => {
    render(WorldPicker, { worlds, value: ['w1'] })

    await expect.element(page.getByRole('button', { name: 'Remove Ashfall' })).toBeDisabled()
    await expect.element(page.getByText(/last World can't be removed/)).toBeVisible()
  })

  it('does not lock chips while more than one World is chosen', async () => {
    render(WorldPicker, { worlds, value: ['w1', 'w2'] })

    await expect.element(page.getByRole('button', { name: 'Remove Ashfall' })).toBeEnabled()
    await expect.element(page.getByText(/last World can't be removed/)).not.toBeInTheDocument()
  })

  it('asks for at least one World when none are chosen', async () => {
    render(WorldPicker, { worlds, value: [] })

    await expect.element(page.getByText('A Campaign needs at least one World')).toBeVisible()
  })

  it('disables the select once every World is chosen', async () => {
    render(WorldPicker, { worlds, value: ['w1', 'w2', 'w3'] })

    await expect.element(addSelect()).toBeDisabled()
  })

  it('submits chosen World ids with the surrounding form', async () => {
    render(WorldPicker, { worlds, value: ['w1', 'w3'] })

    const inputs = document.querySelectorAll<HTMLInputElement>('input[name="worldId"]')
    expect([...inputs].map((i) => i.value)).toEqual(['w1', 'w3'])
  })
})
