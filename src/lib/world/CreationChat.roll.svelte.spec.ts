import { page } from 'vitest/browser'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { formatCardValue } from '#lib/character/conversation.ts'
import CreationChat from './CreationChat.svelte'

afterEach(() => vi.unstubAllGlobals())

function turnReturning(result: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(result), { status: 200 }))
  )
}

const setup = () => {
  const onaccept = vi.fn()
  render(CreationChat, {
    seed: { abilityRolls: '' },
    onaccept,
    endpoint: '/api/character-creation',
    labels: { abilityRolls: 'Roll' },
    formatValue: formatCardValue
  })
  return onaccept
}

describe('CreationChat Roll card', () => {
  it('shows the dice and total, and accepting hands the raw value over', async () => {
    turnReturning({ ok: true, reply: 'Rolled!', proposals: { abilityRolls: '6,5,4,1;3,3,2,1' } })
    const onaccept = setup()

    await page.getByRole('textbox', { name: 'Message' }).fill('roll for me')
    await page.getByRole('button', { name: 'Send' }).click()

    await expect.element(page.getByText('Roll 1: 6 + 5 + 4 + 1 (drop lowest) = 15')).toBeVisible()
    await page.getByRole('button', { name: 'Accept' }).click()
    expect(onaccept).toHaveBeenCalledWith('abilityRolls', '6,5,4,1;3,3,2,1')
  })

  it('discards a dismissed roll without touching the draft', async () => {
    turnReturning({ ok: true, reply: 'Rolled!', proposals: { abilityRolls: '6,5,4,1' } })
    const onaccept = setup()

    await page.getByRole('textbox', { name: 'Message' }).fill('roll')
    await page.getByRole('button', { name: 'Send' }).click()
    await page.getByRole('button', { name: 'Dismiss' }).click()

    expect(onaccept).not.toHaveBeenCalled()
  })
})
