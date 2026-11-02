import { page } from 'vitest/browser'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { createRawSnippet } from 'svelte'
import Field from './Field.svelte'

const control = createRawSnippet<[string, string | undefined]>((id, describedby) => ({
  render: () =>
    `<input id="${id()}" name="title"${describedby() ? ` aria-describedby="${describedby()}"` : ''} />`
}))

describe('Field', () => {
  it('keeps the label as the control accessible name', async () => {
    render(Field, { label: 'Title', children: control })

    await expect.element(page.getByRole('textbox', { name: 'Title' })).toBeVisible()
  })

  it('links the error to the control and announces it', async () => {
    render(Field, { label: 'Title', error: 'Title is required', children: control })

    await expect.element(page.getByRole('alert')).toHaveTextContent('Title is required')
    await expect
      .element(page.getByRole('textbox', { name: 'Title' }))
      .toHaveAccessibleDescription('Title is required')
  })

  it('links the hint as the description', async () => {
    render(Field, { label: 'Title', hint: 'Shown in the list', children: control })

    await expect
      .element(page.getByRole('textbox', { name: 'Title' }))
      .toHaveAccessibleDescription('Shown in the list')
    await expect.element(page.getByRole('alert')).not.toBeInTheDocument()
  })
})
