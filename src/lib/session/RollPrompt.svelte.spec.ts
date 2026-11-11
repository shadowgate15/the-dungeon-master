import { page } from 'vitest/browser'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-svelte'
import RollPrompt from './RollPrompt.svelte'

const request = { check: 'skill', key: 'stealth', dc: 12, reason: 'Slip past the guard.' } as const

describe('RollPrompt', () => {
  it('shows the check, the DC and the reason', async () => {
    render(RollPrompt, { request, onroll: () => {} })

    await expect.element(page.getByText('Stealth check, DC 12')).toBeVisible()
    await expect.element(page.getByText('Slip past the guard.')).toBeVisible()
  })

  it('rolls on click', async () => {
    const onroll = vi.fn()
    render(RollPrompt, { request, onroll })

    await page.getByRole('button', { name: 'Roll d20' }).click()

    expect(onroll).toHaveBeenCalledOnce()
  })

  it('cannot be clicked while busy', async () => {
    render(RollPrompt, { request, busy: true, onroll: () => {} })

    await expect.element(page.getByRole('button', { name: 'Roll d20' })).toBeDisabled()
  })
})
