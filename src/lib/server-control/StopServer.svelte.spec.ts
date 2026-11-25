import { page } from 'vitest/browser'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-svelte'
import StopServer from './StopServer.svelte'

afterEach(() => vi.unstubAllGlobals())

describe('StopServer', () => {
  it('asks first, then stops the game server and says how to start it again', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 202 }))
    vi.stubGlobal('fetch', fetch)
    render(StopServer)

    await page.getByRole('button', { name: 'Stop server' }).click()
    expect(fetch).not.toHaveBeenCalled()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await page.getByRole('button', { name: 'Stop server' }).click()
    await page.getByRole('button', { name: 'Stop the server' }).click()

    expect(fetch).toHaveBeenCalledWith('/api/server/stop', { method: 'POST' })
    await expect
      .element(page.getByRole('status'))
      .toHaveTextContent('The game server stopped. Run dm to start it again.')
  })

  it('says so when the server refuses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('Forbidden', { status: 403 }))
    )
    render(StopServer)
    await page.getByRole('button', { name: 'Stop server' }).click()
    await page.getByRole('button', { name: 'Stop the server' }).click()
    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('The server could not be stopped')
  })
})
