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

const props = (over: Record<string, unknown> = {}) => ({
  campaignId: 'c1',
  length: 'short' as const,
  arc: null,
  canGenerate: true,
  structureLocked: false,
  readOnly: false,
  onchange: () => {},
  ...over
})

const bodyOf = (fetcher: ReturnType<typeof vi.fn>, call = 0) =>
  JSON.parse((fetcher.mock.calls[call][1] as RequestInit).body as string)

describe('ArcSection', () => {
  it('shows the empty state and a Generate Arc button', async () => {
    render(ArcSection, props())

    await expect.element(page.getByText(/No Arc yet/)).toBeVisible()
    await expect.element(page.getByText(/may deviate/)).toBeVisible()
    await expect.element(page.getByRole('button', { name: 'Generate Arc' })).toBeEnabled()
  })

  it('collapses and expands from the Arc heading', async () => {
    render(ArcSection, props({ arc: arc() }))
    const toggle = page.getByRole('button', { name: 'Arc', exact: true })

    await expect.element(toggle).toHaveAttribute('aria-expanded', 'true')
    await expect.element(page.getByText('Draft Arc.', { exact: false })).toBeVisible()

    await toggle.click()
    await expect.element(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect.element(page.getByText('Draft Arc.', { exact: false })).not.toBeVisible()

    await toggle.click()
    await expect.element(page.getByText('Draft Arc.', { exact: false })).toBeVisible()
  })

  it('explains why there is no Generate Arc once play has started', async () => {
    render(ArcSection, props({ canGenerate: false, structureLocked: true }))

    await expect.element(page.getByText(/already started/)).toBeVisible()
    await expect.element(page.getByRole('button', { name: 'Generate Arc' })).toBeDisabled()
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
    render(ArcSection, props({ fetcher, onchange }))

    await page.getByRole('button', { name: 'Generate Arc' }).click()
    await expect.element(page.getByText('Generating the Arc…')).toBeVisible()
    await page.getByRole('button', { name: 'Stop' }).click()

    expect(signal?.aborted).toBe(true)
    await expect.element(page.getByRole('button', { name: 'Generate Arc' })).toBeVisible()
    expect(onchange).not.toHaveBeenCalled()
    await expect.element(page.getByRole('alert')).not.toBeInTheDocument()
  })

  it('shows a danger alert with Try again on failure, and tries again', async () => {
    const fetcher = vi
      .fn()
      .mockImplementationOnce(() =>
        response({ ok: false, failure: { kind: 'invalid-output', message: 'bad' } })
      )
      .mockImplementationOnce(() => response({ ok: true }))
    const onchange = vi.fn()
    render(ArcSection, props({ fetcher, onchange, arc: arc() }))

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
    render(ArcSection, props({ fetcher, onchange, arc: arc() }))

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
    render(ArcSection, props({ fetcher, arc: arc() }))

    await page.getByRole('button', { name: 'Regenerate' }).click()

    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce())
    expect(bodyOf(fetcher)).toEqual({ action: 'generate' })
  })

  it('asks before regenerating an accepted Arc', async () => {
    const fetcher = vi.fn(() => response({ ok: true }))
    render(ArcSection, props({ fetcher, arc: arc('accepted') }))

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
    render(ArcSection, props({ arc: arc() }))

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
    render(ArcSection, props({ arc: one }))

    await expect
      .element(page.getByRole('button', { name: 'Delete Beat 1 of Act 1' }))
      .toBeDisabled()
  })

  it('reorders Acts and Beats', async () => {
    const fetcher = vi.fn(() => response({ ok: true }))
    render(ArcSection, props({ fetcher, arc: arc() }))

    await page.getByRole('button', { name: 'Move Act 1 down' }).click()
    await page.getByRole('button', { name: 'Move Beat 2 of Act 3 up' }).click()
    await page.getByRole('button', { name: 'Save changes' }).click()

    await vi.waitFor(() => expect(fetcher).toHaveBeenCalled())
    const { arc: saved } = bodyOf(fetcher)
    expect(saved.acts.map((a: { id: string }) => a.id)).toEqual(['act-1', 'act-0', 'act-2'])
    expect(saved.acts[2].beats.map((b: { id: string }) => b.id)).toEqual(['beat-2-1', 'beat-2-0'])
  })

  it('locks structure and Regenerate after play starts, but text stays editable', async () => {
    const fetcher = vi.fn(() => response({ ok: true }))
    render(
      ArcSection,
      props({
        fetcher,
        arc: arc('accepted'),
        canGenerate: false,
        structureLocked: true
      })
    )

    await expect.element(page.getByRole('button', { name: 'Regenerate' })).toBeDisabled()
    await expect.element(page.getByText(/already started/)).toBeVisible()
    await expect.element(page.getByRole('button', { name: 'Add Act' })).not.toBeInTheDocument()
    await expect
      .element(page.getByRole('button', { name: /Delete Beat/ }).first())
      .not.toBeInTheDocument()
    await page.getByLabelText('Resolution').fill('A new ending.')
    await page.getByRole('button', { name: 'Save changes' }).click()

    await vi.waitFor(() => expect(fetcher).toHaveBeenCalled())
    expect(bodyOf(fetcher).arc.resolution).toBe('A new ending.')
  })

  it('is read-only on an archived Campaign: no editing, generating or accepting', async () => {
    render(ArcSection, props({ arc: arc(), canGenerate: false, readOnly: true }))

    await expect.element(page.getByLabelText('Title', { exact: true })).toBeDisabled()
    await expect.element(page.getByRole('button', { name: 'Regenerate' })).not.toBeInTheDocument()
    await expect.element(page.getByRole('button', { name: 'Accept Arc' })).not.toBeInTheDocument()
  })

  describe('Beat progress after play starts', () => {
    const progressed = (): ArcViewData => {
      const a = arc('accepted')
      a.acts[0].beats[0] = { ...a.acts[0].beats[0], state: 'reached', sessionNumber: 2 }
      a.acts[0].beats[1] = { ...a.acts[0].beats[1], state: 'abandoned', sessionNumber: 3 }
      return a
    }
    const locked = { canGenerate: false, structureLocked: true }

    it('shows each Beat as pending, reached in a Session or abandoned', async () => {
      render(ArcSection, props({ ...locked, arc: progressed() }))

      await expect.element(page.getByText('Reached in Session 2')).toBeVisible()
      await expect.element(page.getByText('Abandoned', { exact: true })).toBeVisible()
      await expect.element(page.getByText('Pending', { exact: true }).first()).toBeVisible()
      await expect.element(page.getByText(/Arc complete/)).not.toBeInTheDocument()
    })

    it('shows the Arc as complete when no Beat is pending', async () => {
      const done = arc('accepted')
      done.acts.forEach((act) =>
        act.beats.forEach((b) => Object.assign(b, { state: 'reached', sessionNumber: 1 }))
      )
      render(ArcSection, props({ ...locked, arc: done }))

      await expect.element(page.getByText(/Arc complete/)).toBeVisible()
    })

    it('shows no Beat state before play starts', async () => {
      render(ArcSection, props({ arc: arc('accepted') }))

      await expect.element(page.getByText('Pending', { exact: true })).not.toBeInTheDocument()
    })
  })
})
