import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PipelineEvent } from '#lib/session/pipeline-events.ts'
import { resolveRoll, sendAction } from '#lib/session/play.ts'
import { refusalResponse, runResponse } from './run-response.ts'

afterEach(() => vi.unstubAllGlobals())

async function* run(...events: PipelineEvent[]) {
  yield* events
}

const received = async (play: (onEvent: (e: PipelineEvent) => void) => Promise<string | null>) => {
  const events: PipelineEvent[] = []
  const problem = await play((e) => events.push(e))
  return { events, problem }
}

describe('a run over the wire', () => {
  it('carries every pipeline event, in order, from the server to the client', async () => {
    const sent: PipelineEvent[] = [
      { type: 'thinking', role: 'director' },
      { type: 'delta', role: 'narrator', kind: 'narration', text: 'Rain.' },
      { type: 'discard' },
      { type: 'done', reason: 'yield' }
    ]
    vi.stubGlobal('fetch', async () => runResponse('s1', run(...sent), new AbortController()))

    const { events, problem } = await received((on) => sendAction('s1', 'I look', on))

    expect(problem).toBeNull()
    expect(events).toEqual(sent)
  })

  it('sends the action text to the action route', async () => {
    const fetchMock = vi.fn(async (_url: unknown, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body)).forwardedProps).toEqual({ text: 'I look' })
      return runResponse('s1', run({ type: 'done', reason: 'yield' }), new AbortController())
    })
    vi.stubGlobal('fetch', fetchMock)
    await received((on) => sendAction('s1', 'I look', on))
    expect(fetchMock.mock.calls[0][0]).toBe('/api/sessions/s1/action')
  })

  it('streams a roll the same way', async () => {
    vi.stubGlobal('fetch', async () =>
      runResponse('s1', run({ type: 'done', reason: 'roll' }), new AbortController())
    )
    const { events } = await received((on) => resolveRoll('s1', on))
    expect(events).toEqual([{ type: 'done', reason: 'roll' }])
  })

  it('aborts the run when the client goes away', async () => {
    const controller = new AbortController()
    const response = runResponse(
      's1',
      (async function* () {
        yield { type: 'thinking', role: 'director' } as const
        await new Promise<void>((resolve) =>
          controller.signal.addEventListener('abort', () => resolve())
        )
      })(),
      controller
    )
    await response.body?.cancel()
    expect(controller.signal.aborted).toBe(true)
  })

  it('tells the client why a run was refused', async () => {
    vi.stubGlobal('fetch', async () => refusalResponse('roll-pending'))
    const { events, problem } = await received((on) => sendAction('s1', 'hi', on))
    expect(events).toEqual([])
    expect(problem).toBe('Roll first.')
  })

  it('maps each refusal to a status', () => {
    expect(refusalResponse('not-found').status).toBe(404)
    expect(refusalResponse('in-flight').status).toBe(409)
    expect(refusalResponse('empty-action').status).toBe(400)
  })
})
