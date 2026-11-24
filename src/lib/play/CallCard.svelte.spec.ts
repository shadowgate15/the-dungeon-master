import { page } from 'vitest/browser'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { attackCall, checkCall, questionCall } from './play-fixtures'
import CallCard from './CallCard.svelte'

describe('CallCard', () => {
  it('shows each Character’s Check with its skill and reason, and rolls on click', async () => {
    const onroll = vi.fn()
    render(CallCard, { call: checkCall, onroll, onanswer: () => {} })

    const card = page.getByRole('region', { name: 'Call' })
    await expect.element(card.getByText('Sleight of Hand check')).toBeVisible()
    await expect.element(card.getByText('The lock is old and stiff')).toBeVisible()
    await page.getByRole('button', { name: 'Roll Sleight of Hand check for Wren' }).click()

    expect(onroll).toHaveBeenCalledWith('p1')
  })

  it('marks a roll on advantage, with its reason', async () => {
    render(CallCard, { call: checkCall, onroll: () => {}, onanswer: () => {} })

    const bram = page.getByRole('group', { name: 'Bram' })
    await expect.element(bram.getByText('Advantage')).toBeVisible()
    await expect.element(bram.getByText('Bram knows these streets')).toBeVisible()
  })

  it('shows a rolled part as rolled, with no button', async () => {
    const call = { ...checkCall, parts: [{ ...checkCall.parts[0], answered: true }] }
    render(CallCard, { call, onroll: () => {}, onanswer: () => {} })

    await expect.element(page.getByText('Rolled')).toBeVisible()
    await expect.element(page.getByRole('button', { name: /Roll/ })).not.toBeInTheDocument()
  })

  it('offers a question’s choices as buttons', async () => {
    const onanswer = vi.fn()
    render(CallCard, { call: questionCall, onroll: () => {}, onanswer })

    await expect.element(page.getByText('Which door?')).toBeVisible()
    await page.getByRole('button', { name: 'Right' }).click()

    expect(onanswer).toHaveBeenCalledWith('p3', 'Right')
  })

  it('takes free text for a question without choices', async () => {
    const onanswer = vi.fn()
    render(CallCard, {
      call: { ...questionCall, choices: [] },
      onroll: () => {},
      onanswer
    })

    await page.getByRole('textbox', { name: 'Your answer' }).fill('A shadow')
    await page.getByRole('button', { name: 'Answer' }).click()

    expect(onanswer).toHaveBeenCalledWith('p3', 'A shadow')
  })

  it('disables rolling while busy', async () => {
    render(CallCard, { call: checkCall, onroll: () => {}, onanswer: () => {}, disabled: true })

    await expect
      .element(page.getByRole('button', { name: 'Roll Sleight of Hand check for Wren' }))
      .toBeDisabled()
  })

  it("offers an attack's next roll, damage after the to-hit", async () => {
    const onroll = vi.fn()
    render(CallCard, { call: attackCall, onroll, onanswer: () => {} })

    await expect.element(page.getByText('Crossbow, light attack')).toBeVisible()
    await page.getByRole('button', { name: 'Roll damage for Wren' }).click()

    expect(onroll).toHaveBeenCalledWith('p4')
  })

  it("rolls each Character's initiative from the batched initiative Call", async () => {
    const onroll = vi.fn()
    const call = {
      ...checkCall,
      kind: 'initiative' as const,
      parts: checkCall.parts.map((p) => ({ ...p, label: 'Initiative', reason: null }))
    }
    render(CallCard, { call, onroll, onanswer: () => {} })

    await page.getByRole('button', { name: 'Roll Initiative for Bram' }).click()

    expect(onroll).toHaveBeenCalledWith('p2')
  })
})
