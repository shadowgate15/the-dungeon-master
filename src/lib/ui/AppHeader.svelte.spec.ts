import { page } from 'vitest/browser'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import AppHeader from './AppHeader.svelte'

const props = { lan: true, joinUrls: [], theme: 'dark' as const, redirectTo: '/' }

describe('AppHeader', () => {
  it('gives the Host the Stop server control', async () => {
    render(AppHeader, { ...props, isHost: true })
    await expect.element(page.getByRole('button', { name: 'Stop server' })).toBeVisible()
  })

  it('hides Stop server from a remote browser, which keeps Credits', async () => {
    render(AppHeader, { ...props, isHost: false })
    await expect.element(page.getByRole('link', { name: 'Credits' })).toBeVisible()
    await expect.element(page.getByRole('button', { name: 'Stop server' })).not.toBeInTheDocument()
  })
})
