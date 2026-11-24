import { page } from 'vitest/browser'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-svelte'
import PermissionCard from './PermissionCard.svelte'

const request = {
  requestId: 'abcde',
  toolName: 'Bash',
  description: 'List the Campaign folder',
  inputPreview: 'ls -la'
}

describe('PermissionCard', () => {
  it('shows the tool and its summary', async () => {
    render(PermissionCard, { request, onanswer: vi.fn() })

    const card = page.getByRole('group', { name: 'Permission request' })
    await expect.element(card).toHaveTextContent(/List the Campaign folder/)
    await expect.element(card).toHaveTextContent(/Bash: ls -la/)
  })

  it('answers Allow or Deny', async () => {
    const onanswer = vi.fn()
    render(PermissionCard, { request, onanswer })

    await page.getByRole('button', { name: 'Allow' }).click()
    await page.getByRole('button', { name: 'Deny' }).click()
    expect(onanswer.mock.calls).toEqual([['allow'], ['deny']])
  })
})
