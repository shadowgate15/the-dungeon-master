import { page } from 'vitest/browser'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-svelte'
import type { ArcViewData } from './arc.ts'
import ArcSection from './ArcSection.svelte'

const arc = (status: 'draft' | 'accepted' = 'draft'): ArcViewData => ({
  id: 'arc-1',
  status,
  title: 'The Ember Crown',
  premise: 'A relic wakes.',
  stakes: 'The valley burns.',
  resolution: 'The relic is destroyed.',
  acts: [0, 1, 2].map((a) => ({
    id: `act-${a}`,
    name: `Act ${a}`,
    purpose: 'Things escalate.',
    beats: [0, 1].map((b) => ({
      id: `beat-${a}-${b}`,
      title: `Beat ${a}.${b}`,
      description: `Something ${a}.${b}.`,
      state: 'pending' as const
    }))
  })),
  ...{}
})

const response = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }))

/** A streamed NDJSON response the test feeds line by line, like the endpoint's generate stream. */
const ndjson = () => {
  const encoder = new TextEncoder()
  let controller!: ReadableStreamDefaultController<Uint8Array>
  const body = new ReadableStream<Uint8Array>({ start: (c) => (controller = c) })
  return {
    response: new Response(body, { headers: { 'content-type': 'application/x-ndjson' } }),
    send: (line: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(line)}\n`)),
    close: () => controller.close()
  }
}

const props = (over: Record<string, unknown> = {}) => ({
  campaignId: 'c1',
  length: 'short' as const,
  arc: null,
  canGenerate: true,
  readOnly: false,
  onchange: () => {},
  ...over
})

const bodyOf = (fetcher: ReturnType<typeof vi.fn>, call = 0) =>
  JSON.parse((fetcher.mock.calls[call][1] as RequestInit).body as string)

const renderOpen = async (p: ReturnType<typeof props>) => {
  render(ArcSection, p)
  await page.getByRole('button', { name: 'Arc', exact: true }).click()
}

describe('ArcSection', () => {
  it('shows the empty state and a Generate Arc button', async () => {
    await renderOpen(props())

    await expect.element(page.getByText(/No Arc yet/)).toBeVisible()
    await expect.element(page.getByText(/may deviate/)).toBeVisible()
    await expect.element(page.getByRole('button', { name: 'Generate Arc' })).toBeEnabled()
  })

  it('starts collapsed and expands from the Arc heading', async () => {
    render(ArcSection, props({ arc: arc() }))
    const toggle = page.getByRole('button', { name: 'Arc', exact: true })

    await expect.element(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect.element(page.getByText('Draft Arc.', { exact: false })).not.toBeVisible()

    await toggle.click()
    await expect.element(toggle).toHaveAttribute('aria-expanded', 'true')
    await expect.element(page.getByText('Draft Arc.', { exact: false })).toBeVisible()

    await toggle.click()
    await expect.element(page.getByText('Draft Arc.', { exact: false })).not.toBeVisible()
  })

  it('shows a status line and Stop while generating; Stop leaves things as they were', async () => {
    let signal: AbortSignal | undefined
    const fetcher = vi.fn((_: string, init: RequestInit) => {
      signal = init.signal as AbortSignal
      // Like fetch: rejects with an AbortError when the signal fires.
      return new Promise<Response>((_, reject) =>
        signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      )
    })
    const onchange = vi.fn()
    await renderOpen(props({ fetcher, onchange }))

    await page.getByRole('button', { name: 'Generate Arc' }).click()
    await expect.element(page.getByText('Generating the Arc…')).toBeVisible()
    await page.getByRole('button', { name: 'Stop' }).click()

    expect(signal?.aborted).toBe(true)
    await expect.element(page.getByRole('button', { name: 'Generate Arc' })).toBeVisible()
    expect(onchange).not.toHaveBeenCalled()
    await expect.element(page.getByRole('alert')).not.toBeInTheDocument()
  })

  it('shows the step label and Stop throughout, and the draft arrives on the final line', async () => {
    const stream = ndjson()
    const onchange = vi.fn()
    await renderOpen(props({ fetcher: vi.fn(() => Promise.resolve(stream.response)), onchange }))

    await page.getByRole('button', { name: 'Generate Arc' }).click()
    await expect.element(page.getByRole('button', { name: 'Stop' })).toBeVisible()

    stream.send({ type: 'progress', step: { kind: 'skeleton' } })
    await expect.element(page.getByText('Planning the story…')).toBeVisible()
    await expect.element(page.getByRole('button', { name: 'Stop' })).toBeVisible()

    stream.send({ type: 'progress', step: { kind: 'act', number: 2, of: 3 } })
    await expect.element(page.getByText('Writing Act 2 of 3…')).toBeVisible()
    await expect.element(page.getByRole('button', { name: 'Stop' })).toBeVisible()
    expect(onchange).not.toHaveBeenCalled()

    stream.send({ type: 'result', ok: true })
    stream.close()
    await vi.waitFor(() => expect(onchange).toHaveBeenCalledOnce())
  })

  it('shows the failure from a final failure line', async () => {
    const stream = ndjson()
    await renderOpen(props({ fetcher: vi.fn(() => Promise.resolve(stream.response)) }))

    await page.getByRole('button', { name: 'Generate Arc' }).click()
    stream.send({ type: 'progress', step: { kind: 'skeleton' } })
    stream.send({ type: 'result', ok: false, failure: { kind: 'timeout', message: 'Too slow' } })
    stream.close()

    await expect.element(page.getByRole('alert')).toHaveTextContent(/Too slow/)
  })

  it('treats a stream that ends without a final line as a generic failure', async () => {
    const stream = ndjson()
    const onchange = vi.fn()
    await renderOpen(props({ fetcher: vi.fn(() => Promise.resolve(stream.response)), onchange }))

    await page.getByRole('button', { name: 'Generate Arc' }).click()
    stream.send({ type: 'progress', step: { kind: 'act', number: 1, of: 3 } })
    stream.close()

    await expect.element(page.getByRole('alert')).toHaveTextContent(/could not be generated/)
    await expect.element(page.getByRole('button', { name: 'Try again' })).toBeVisible()
    expect(onchange).not.toHaveBeenCalled()
  })

  it('shows a plain JSON pre-flight rejection as a failure', async () => {
    const fetcher = vi.fn(() => response({ error: 'AI is not configured' }, 503))
    await renderOpen(props({ fetcher }))

    await page.getByRole('button', { name: 'Generate Arc' }).click()

    await expect.element(page.getByRole('alert')).toHaveTextContent(/AI is not configured/)
  })

  it('shows a danger alert with Try again on failure, and tries again', async () => {
    const fetcher = vi
      .fn()
      .mockImplementationOnce(() =>
        response({ ok: false, failure: { kind: 'invalid-output', message: 'bad' } })
      )
      .mockImplementationOnce(() => response({ ok: true }))
    const onchange = vi.fn()
    await renderOpen(props({ fetcher, onchange, arc: arc() }))

    await page.getByRole('button', { name: 'Regenerate' }).click()
    await expect.element(page.getByRole('alert')).toHaveTextContent(/Your current Arc is unchanged/)
    expect(onchange).not.toHaveBeenCalled()
    await page.getByRole('button', { name: 'Try again' }).click()

    await vi.waitFor(() => expect(onchange).toHaveBeenCalledOnce())
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('shows a generated draft, edits inline, and accepts with the edits', async () => {
    const fetcher = vi.fn(() => response({ ok: true }))
    const onchange = vi.fn()
    await renderOpen(props({ fetcher, onchange, arc: arc() }))

    await expect.element(page.getByText(/Draft/).first()).toBeVisible()
    await page.getByLabelText('Title', { exact: true }).fill('A Better Title')
    await page.getByRole('button', { name: 'Accept Arc' }).click()

    await vi.waitFor(() => expect(onchange).toHaveBeenCalled())
    const body = bodyOf(fetcher)
    expect(body).toMatchObject({ action: 'save', accept: true })
    expect(body.arc.title).toBe('A Better Title')
    expect(body.arc.acts[0].beats[0].id).toBe('beat-0-0')
  })

  it('regenerates a draft without asking', async () => {
    const fetcher = vi.fn(() => response({ ok: true }))
    await renderOpen(props({ fetcher, arc: arc() }))

    await page.getByRole('button', { name: 'Regenerate' }).click()

    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce())
    expect(bodyOf(fetcher)).toEqual({ action: 'generate' })
  })

  it('asks before regenerating an accepted Arc', async () => {
    const fetcher = vi.fn(() => response({ ok: true }))
    await renderOpen(props({ fetcher, arc: arc('accepted') }))

    await page.getByRole('button', { name: 'Regenerate' }).click()
    await expect
      .element(page.getByText(/replaces the whole Arc, including your edits/))
      .toBeVisible()
    expect(fetcher).not.toHaveBeenCalled()
    await page.getByRole('button', { name: 'Keep current' }).click()
    await expect.element(page.getByText(/replaces the whole Arc/)).not.toBeInTheDocument()

    await page.getByRole('button', { name: 'Regenerate' }).click()
    await page.getByRole('button', { name: 'Replace Arc' }).click()
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce())
  })

  it('keeps structure edits inside the Length ranges', async () => {
    // short: exactly 3 Acts and 5 to 8 Beats in total; this Arc has 6.
    await renderOpen(props({ arc: arc() }))

    await expect.element(page.getByRole('button', { name: 'Add Act' })).toBeDisabled()
    await expect.element(page.getByRole('button', { name: 'Delete Act 1' })).toBeDisabled()
    await page.getByRole('button', { name: 'Add Beat to Act 1' }).click()
    await page.getByRole('button', { name: 'Add Beat to Act 1' }).click()
    await expect.element(page.getByRole('button', { name: 'Add Beat to Act 1' })).toBeDisabled()
    await page.getByRole('button', { name: 'Delete Beat 3 of Act 1' }).click()
    await expect.element(page.getByRole('button', { name: 'Add Beat to Act 1' })).toBeEnabled()
  })

  it('keeps every Act at one Beat or more', async () => {
    const one = arc()
    one.acts[0].beats.pop()
    await renderOpen(props({ arc: one }))

    await expect
      .element(page.getByRole('button', { name: 'Delete Beat 1 of Act 1' }))
      .toBeDisabled()
  })

  it('reorders Acts and Beats', async () => {
    const fetcher = vi.fn(() => response({ ok: true }))
    await renderOpen(props({ fetcher, arc: arc() }))

    await page.getByRole('button', { name: 'Move Act 1 down' }).click()
    await page.getByRole('button', { name: 'Move Beat 2 of Act 3 up' }).click()
    await page.getByRole('button', { name: 'Save changes' }).click()

    await vi.waitFor(() => expect(fetcher).toHaveBeenCalled())
    const { arc: saved } = bodyOf(fetcher)
    expect(saved.acts.map((a: { id: string }) => a.id)).toEqual(['act-1', 'act-0', 'act-2'])
    expect(saved.acts[2].beats.map((b: { id: string }) => b.id)).toEqual(['beat-2-1', 'beat-2-0'])
  })

  it('is read-only on an archived Campaign: no editing, generating or accepting', async () => {
    await renderOpen(props({ arc: arc(), canGenerate: false, readOnly: true }))

    await expect.element(page.getByLabelText('Title', { exact: true })).toBeDisabled()
    await expect.element(page.getByRole('button', { name: 'Regenerate' })).not.toBeInTheDocument()
    await expect.element(page.getByRole('button', { name: 'Accept Arc' })).not.toBeInTheDocument()
  })
})
