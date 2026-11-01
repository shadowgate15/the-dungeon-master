import { page } from 'vitest/browser'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-svelte'
import AiStatusView from './AiStatusView.svelte'

describe('AiStatusView', () => {
  it('shows the model name and a ready status with enabled chat controls', async () => {
    render(AiStatusView, {
      status: { state: 'ready', model: 'qwen3-4b-2507', contextLength: 8192 },
      checking: false,
      oncheck: () => {}
    })

    await expect.element(page.getByText('qwen3-4b-2507')).toBeVisible()
    await expect.element(page.getByText('Connected')).toBeVisible()
    await expect.element(page.getByLabelText('Message')).toBeEnabled()
  })

  it('is quiet when no model is configured, with disabled AI controls', async () => {
    render(AiStatusView, {
      status: { state: 'not-configured' },
      checking: false,
      oncheck: () => {}
    })

    await expect.element(page.getByText('AI is not configured')).toBeVisible()
    await expect.element(page.getByLabelText('Message')).toBeDisabled()
    await expect.element(page.getByRole('button', { name: 'Send' })).toBeDisabled()
  })

  it('hints at server configuration when not connected', async () => {
    render(AiStatusView, {
      status: { state: 'unreachable', model: 'qwen3-4b-2507' },
      checking: false,
      oncheck: () => {}
    })

    await expect.element(page.getByText('Not connected')).toBeVisible()
    await expect.element(page.getByText(/server configuration/i)).toBeVisible()
    await expect.element(page.getByLabelText('Message')).toBeDisabled()
  })

  it('names the configured model when LM Studio does not have it', async () => {
    render(AiStatusView, {
      status: { state: 'model-unavailable', model: 'qwen3-4b-2507' },
      checking: false,
      oncheck: () => {}
    })

    await expect.element(page.getByText(/qwen3-4b-2507.*not available/i)).toBeVisible()
    await expect.element(page.getByLabelText('Message')).toBeDisabled()
  })

  it('re-probes when Check connection is clicked', async () => {
    const oncheck = vi.fn()
    render(AiStatusView, {
      status: { state: 'unreachable', model: 'm' },
      checking: false,
      oncheck
    })

    await page.getByRole('button', { name: 'Check connection' }).click()

    expect(oncheck).toHaveBeenCalledOnce()
  })
})
