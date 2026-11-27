import { page } from 'vitest/browser'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import LanStatus from './LanStatus.svelte'

const joinUrls = ['http://192.168.1.20:4777/campaigns/abc', 'http://mac.local:4777/campaigns/abc']

describe('LanStatus', () => {
  it('shows the Open on LAN badge to the Host in LAN mode', async () => {
    render(LanStatus, { lan: true, isHost: true, joinUrls })

    await expect.element(page.getByText('Open on LAN')).toBeVisible()
  })

  it('shows nothing outside LAN mode', async () => {
    render(LanStatus, { lan: false, isHost: true, joinUrls: [] })

    await expect.element(page.getByText('Open on LAN')).not.toBeInTheDocument()
    await expect.element(page.getByRole('region', { name: 'Join' })).not.toBeInTheDocument()
  })

  it('shows nothing to a remote browser', async () => {
    render(LanStatus, { lan: true, isHost: false, joinUrls })

    await expect.element(page.getByText('Open on LAN')).not.toBeInTheDocument()
    await expect.element(page.getByText('192.168.1.20')).not.toBeInTheDocument()
  })
})
