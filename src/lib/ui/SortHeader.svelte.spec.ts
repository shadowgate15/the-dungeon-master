import { page } from 'vitest/browser'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { createRawSnippet } from 'svelte'
import SortHeader from './SortHeader.svelte'

const label = createRawSnippet(() => ({ render: () => '<span>Name</span>' }))

describe('SortHeader', () => {
  it('exposes the sort direction as aria-sort', async () => {
    render(SortHeader, { sort: 'ascending', children: label })

    const th = page.getByRole('button', { name: 'Name' }).element().closest('th')
    expect(th?.getAttribute('aria-sort')).toBe('ascending')
  })

  it('omits aria-sort when unsorted', async () => {
    render(SortHeader, { children: label })

    const th = page.getByRole('button', { name: 'Name' }).element().closest('th')
    expect(th?.hasAttribute('aria-sort')).toBe(false)
  })

  it('calls onsort when activated', async () => {
    let sorted = 0
    render(SortHeader, { onsort: () => sorted++, children: label })

    await page.getByRole('button', { name: 'Name' }).click()

    expect(sorted).toBe(1)
  })
})
