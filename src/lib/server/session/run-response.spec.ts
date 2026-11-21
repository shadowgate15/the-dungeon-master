import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ExchangeEvent } from '#lib/session/exchange-events.ts'
import { answerCall, sendAction } from '#lib/session/play.ts'
import { refusalResponse, runResponse } from './run-response.ts'

afterEach(() => vi.unstubAllGlobals())

async function* run(...events: ExchangeEvent[]) {
  yield* events
}

const received = async (play: (onEvent: (e: ExchangeEvent) => void) => Promise<string | null>) => {
  const events: ExchangeEvent[] = []
  const problem = await play((e) => events.push(e))
  return { events, problem }
}

describe('a run over the wire', () => {
  it('carries every Exchange event, in order, from the server to the client', async () => {
    const sent: ExchangeEvent[] = [
      { type: 'thinking', step: 'adjudication' },
      { type: 'delta', role: 'narrator', kind: 'narration', text: 'Rain.' },
      { type: 'discard' },
      { type: 'done', reason: 'replied' }
    ]
    vi.stubGlobal('fetch', async () => runResponse('s1', run(...sent), new AbortController()))

    const { events, problem } = await received((on) => sendAction('s1', 'I look', on))

    expect(problem).toBeNull()
    expect(events).toEqual(sent)
  })

  it('sends the Declaration text to the action route', async () => {
    const fetchMock = vi.fn(async (_url: unknown, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body)).forwardedProps).toEqual({ text: 'I look' })
      return runResponse('s1', run({ type: 'done', reason: 'replied' }), new AbortController())
    })
    vi.stubGlobal('fetch', fetchMock)
    await received((on) => sendAction('s1', 'I look', on))
    expect(fetchMock.mock.calls[0][0]).toBe('/api/sessions/s1/action')
  })

  it('sends a roll to the answer route', async () => {
    const fetchMock = vi.fn(async (_url: unknown, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body)).forwardedProps).toEqual({ answer: { kind: 'roll' } })
      return runResponse('s1', run({ type: 'done', reason: 'replied' }), new AbortController())
    })
    vi.stubGlobal('fetch', fetchMock)
    await received((on) => answerCall('s1', { kind: 'roll' }, on))
    expect(fetchMock.mock.calls[0][0]).toBe('/api/sessions/s1/answer')
  })

  it('tells the client when there is no Call to answer', async () => {
    vi.stubGlobal('fetch', async () => refusalResponse('no-open-call'))
    const { problem } = await received((on) => answerCall('s1', { kind: 'roll' }, on))
    expect(problem).toBe('There is nothing to answer right now.')
  })

  it('carries the ruling to the client for the inspector', async () => {
    const ruling: ExchangeEvent = {
      type: 'ruling',
      adjudication: { outcome: 'happens' },
      effect: { effect: 'move', exitId: 'front-door' }
    }
    vi.stubGlobal('fetch', async () => runResponse('s1', run(ruling), new AbortController()))
    const { events } = await received((on) => sendAction('s1', 'I leave', on))
    expect(events).toEqual([ruling])
  })

  it('aborts the run when the client goes away', async () => {
    const controller = new AbortController()
    const response = runResponse(
      's1',
      (async function* () {
        yield { type: 'thinking', step: 'adjudication' } as const
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
    vi.stubGlobal('fetch', async () => refusalResponse('in-flight'))
    const { events, problem } = await received((on) => sendAction('s1', 'hi', on))
    expect(events).toEqual([])
    expect(problem).toBe('The previous Declaration is still being answered.')
  })

  it('maps each refusal to a status', () => {
    expect(refusalResponse('not-found').status).toBe(404)
    expect(refusalResponse('in-flight').status).toBe(409)
    expect(refusalResponse('empty-action').status).toBe(400)
    expect(refusalResponse('no-open-call').status).toBe(409)
  })
})
