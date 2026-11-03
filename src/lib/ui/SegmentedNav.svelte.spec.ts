import { page } from 'vitest/browser'
import { describe, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { expect } from 'vitest'
import SegmentedNav from './SegmentedNav.svelte'

describe('SegmentedNav', () => {
  it('renders real links in a labelled navigation, marking the current one', async () => {
    render(SegmentedNav, {
      label: 'World view',
      items: [
        { href: '/', label: 'Active (2)', current: true },
        { href: '/?view=archived', label: 'Archived (1)', current: false }
      ]
    })

    await expect.element(page.getByRole('navigation', { name: 'World view' })).toBeVisible()
    const active = page.getByRole('link', { name: 'Active (2)' })
    await expect.element(active).toHaveAttribute('aria-current', 'page')
    await expect.element(active).toHaveAttribute('href', '/')
    await expect
      .element(page.getByRole('link', { name: 'Archived (1)' }))
      .not.toHaveAttribute('aria-current')
  })
})
