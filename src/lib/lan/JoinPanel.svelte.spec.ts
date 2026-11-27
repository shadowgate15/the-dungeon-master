import { page } from 'vitest/browser'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import JoinPanel from './JoinPanel.svelte'

const joinUrls = ['http://192.168.1.20:4777/campaigns/abc', 'http://mac.local:4777/campaigns/abc']

describe('JoinPanel', () => {
  it('lists every join URL', async () => {
    render(JoinPanel, { joinUrls })

    const panel = page.getByRole('region', { name: 'Join' })
    await expect.element(panel).toHaveTextContent('http://192.168.1.20:4777/campaigns/abc')
    await expect.element(panel).toHaveTextContent('http://mac.local:4777/campaigns/abc')
  })

  it('draws a QR code for each URL', async () => {
    render(JoinPanel, { joinUrls })

    await expect
      .element(
        page.getByRole('img', { name: 'QR code for http://192.168.1.20:4777/campaigns/abc' })
      )
      .toBeVisible()
    await expect
      .element(page.getByRole('img', { name: 'QR code for http://mac.local:4777/campaigns/abc' }))
      .toBeVisible()
  })

  it('says so when there is no address to join at', async () => {
    render(JoinPanel, { joinUrls: [] })

    await expect.element(page.getByText('No network address found')).toBeVisible()
  })
})
