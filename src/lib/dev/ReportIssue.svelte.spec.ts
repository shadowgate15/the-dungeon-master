import { page, userEvent } from 'vitest/browser'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-svelte'
import ReportIssue from './ReportIssue.svelte'

const props = {
  url: 'http://localhost:5173/campaigns/7',
  route: '/campaigns/[id]',
  params: { id: '7' }
}

const reply = (status: number, body: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status }))

const open = async () => {
  await page.getByRole('button', { name: 'Report an issue' }).click()
}

describe('ReportIssue', () => {
  it('opens a dialog from the floating button', async () => {
    render(ReportIssue, { ...props, fetcher: reply(200, {}) })

    await open()

    await expect.element(page.getByRole('dialog', { name: 'Report an issue' })).toBeVisible()
  })

  it('will not send a report without a title', async () => {
    const fetcher = reply(200, {})
    render(ReportIssue, { ...props, fetcher })
    await open()

    await page.getByRole('button', { name: 'Send report' }).click()

    await expect.element(page.getByText('Add a title')).toBeVisible()
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('sends what was written with the page it was written on, then links the new issue', async () => {
    const fetcher = reply(200, { url: 'https://github.com/o/r/issues/301' })
    render(ReportIssue, { ...props, fetcher })
    await open()

    await userEvent.fill(page.getByLabelText('Title'), 'Roll button does nothing')
    await userEvent.fill(page.getByLabelText('What happened?'), 'Clicked it twice.')
    await page.getByRole('button', { name: 'Send report' }).click()

    await expect
      .element(page.getByRole('link', { name: 'https://github.com/o/r/issues/301' }))
      .toHaveAttribute('href', 'https://github.com/o/r/issues/301')
    expect(fetcher).toHaveBeenCalledTimes(1)
    const [endpoint, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit]
    expect(endpoint).toBe('/api/dev/report-issue')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toMatchObject({
      title: 'Roll button does nothing',
      description: 'Clicked it twice.',
      context: { url: props.url, route: props.route, params: props.params }
    })
  })

  it('shows why the report failed and keeps what was written', async () => {
    render(ReportIssue, {
      ...props,
      fetcher: reply(502, { error: '`gh` is not installed, so no issue was filed.' })
    })
    await open()

    await userEvent.fill(page.getByLabelText('Title'), 'Roll button does nothing')
    await page.getByRole('button', { name: 'Send report' }).click()

    await expect.element(page.getByRole('alert')).toHaveTextContent('`gh` is not installed')
    await expect.element(page.getByLabelText('Title')).toHaveValue('Roll button does nothing')
  })
})
