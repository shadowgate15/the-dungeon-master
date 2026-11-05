import { page } from 'vitest/browser'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import SectionNav from './SectionNav.svelte'

describe('SectionNav', () => {
  it('links Worlds and Campaigns, marking the current section', async () => {
    render(SectionNav, { current: 'campaigns' })

    await expect.element(page.getByRole('navigation', { name: 'Sections' })).toBeVisible()
    await expect
      .element(page.getByRole('link', { name: 'Campaigns' }))
      .toHaveAttribute('aria-current', 'page')
    await expect
      .element(page.getByRole('link', { name: 'Worlds' }))
      .not.toHaveAttribute('aria-current')
    await expect.element(page.getByRole('link', { name: 'Worlds' })).toHaveAttribute('href', '/')
    await expect
      .element(page.getByRole('link', { name: 'Characters' }))
      .toHaveAttribute('href', '/characters')
  })
})
