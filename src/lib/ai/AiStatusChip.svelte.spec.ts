import { page } from 'vitest/browser'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-svelte'
import AiStatusChip from './AiStatusChip.svelte'
import type { AiStatus } from './status.ts'

const store = (status: AiStatus | undefined, check = vi.fn()) => ({
  status,
  checking: false,
  check
})

describe('AiStatusChip', () => {
  it('shows only the model name until opened', async () => {
    render(AiStatusChip, {
      ai: store({ state: 'ready', model: 'qwen3-4b-2507', contextLength: 8192 })
    })

    await expect.element(page.getByText('qwen3-4b-2507')).toBeVisible()
    const details = page.getByRole('group')
    await expect.element(details).not.toHaveAttribute('open')

    await page.getByText('qwen3-4b-2507').click()
    await expect.element(details).toHaveAttribute('open')
    await expect.element(page.getByText('Connected')).toBeVisible()
  })

  it('says AI is unavailable and explains it when opened', async () => {
    render(AiStatusChip, { ai: store({ state: 'unreachable', model: 'qwen3-4b-2507' }) })

    await page.getByText('AI unavailable').click()
    await expect.element(page.getByText(/server configuration/i)).toBeVisible()
  })

  it('is quiet when no model is configured', async () => {
    render(AiStatusChip, { ai: store({ state: 'not-configured' }) })

    await page.getByText('AI off').click()
    await expect.element(page.getByText('AI is not configured')).toBeVisible()
  })

  it('re-checks from the popover', async () => {
    const check = vi.fn()
    render(AiStatusChip, { ai: store({ state: 'unreachable', model: 'm' }, check) })

    await page.getByText('AI unavailable').click()
    await page.getByRole('button', { name: 'Check connection' }).click()
    expect(check).toHaveBeenCalledOnce()
  })
})
