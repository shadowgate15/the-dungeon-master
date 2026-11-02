import { page } from 'vitest/browser'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { createRawSnippet } from 'svelte'
import Panel from './Panel.svelte'

const body = createRawSnippet(() => ({ render: () => '<p>Ready</p>' }))

describe('Panel', () => {
  it('is a region named by its title', async () => {
    render(Panel, { title: 'AI status', children: body })

    await expect.element(page.getByRole('region', { name: 'AI status' })).toHaveTextContent('Ready')
  })

  it('renders the title as a heading of the requested level', async () => {
    render(Panel, { title: 'AI status', level: 3, children: body })

    await expect.element(page.getByRole('heading', { name: 'AI status', level: 3 })).toBeVisible()
  })

  it('defaults to a level 2 heading', async () => {
    render(Panel, { title: 'AI status', children: body })

    await expect.element(page.getByRole('heading', { name: 'AI status', level: 2 })).toBeVisible()
  })
})
