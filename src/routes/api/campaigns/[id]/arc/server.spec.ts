import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  campaign: undefined as Record<string, unknown> | undefined,
  canGenerate: true,
  port: {} as object | null,
  locked: false,
  unavailable: null as unknown,
  generate: vi.fn(),
  replaceWithDraft: vi.fn()
}))

vi.mock('#lib/server/db/index.ts', () => ({ db: {} }))
vi.mock('#lib/server/campaign/service.ts', () => ({
  createCampaignService: () => ({ get: () => mocks.campaign })
}))
vi.mock('#lib/server/ai/index.ts', () => ({
  getAiStatus: async () => ({ state: 'ready' }),
  getChatPort: () => mocks.port,
  isReasoningModelLocked: () => mocks.locked,
  lockReasoningModel: vi.fn()
}))
vi.mock('#lib/server/ai/availability.ts', () => ({ unavailableFailure: () => mocks.unavailable }))
vi.mock('#lib/server/arc/index.ts', () => ({
  arcs: {
    availability: () => ({ canGenerate: mocks.canGenerate }),
    replaceWithDraft: mocks.replaceWithDraft,
    save: vi.fn()
  }
}))
vi.mock('#lib/server/arc/generate.ts', () => ({ generateArc: mocks.generate }))

import { ARC_CHUNK } from '#lib/arc/arc.ts'
import { ArcLockedError, ArcValidationError } from '#lib/server/arc/service.ts'
import { POST } from './+server.ts'

const post = (body: unknown, signal = new AbortController().signal) =>
  POST({
    request: { json: async () => body, signal },
    params: { id: 'c1' }
  } as never)

/** The generate request as TanStack AI's connection sends it: the action rides in forwardedProps. */
const GENERATE = { forwardedProps: { action: 'generate' } }

/** Every AG-UI chunk of a server-sent-events response. */
const chunks = async (response: Response) =>
  (await response.text())
    .split('\n\n')
    .filter((frame) => frame.startsWith('data: '))
    .map((frame) => JSON.parse(frame.slice('data: '.length)))

/** The Arc events of a generate stream: the value of each `ARC_CHUNK` custom chunk. */
const lines = async (response: Response) =>
  (await chunks(response))
    .filter((c) => c.type === 'CUSTOM' && c.name === ARC_CHUNK)
    .map((c) => c.value)

beforeEach(() => {
  Object.assign(mocks, {
    campaign: { id: 'c1', name: 'N', premise: 'P', tone: 'dark', length: 'short', worlds: [] },
    canGenerate: true,
    port: {},
    locked: false,
    unavailable: null
  })
  mocks.generate.mockReset()
  mocks.replaceWithDraft.mockReset()
})

describe('Arc endpoint generate action', () => {
  it('streams progress lines in order, then one success line, and stores the draft', async () => {
    mocks.generate.mockImplementation(async (_port, _seed, options) => {
      options.onProgress({ kind: 'skeleton' })
      options.onProgress({ kind: 'act', number: 1, of: 2 })
      options.onProgress({ kind: 'act', number: 2, of: 2 })
      return { ok: true, arc: { title: 'T' } }
    })

    const response = await post(GENERATE)

    expect(response.headers.get('content-type')).toContain('text/event-stream')
    const sent = await chunks(response)
    expect(sent[0].type).toBe('RUN_STARTED')
    expect(sent.at(-1).type).toBe('RUN_FINISHED')
    expect(
      sent.filter((c) => c.type === 'CUSTOM' && c.name === ARC_CHUNK).map((c) => c.value)
    ).toEqual([
      { type: 'progress', step: { kind: 'skeleton' } },
      { type: 'progress', step: { kind: 'act', number: 1, of: 2 } },
      { type: 'progress', step: { kind: 'act', number: 2, of: 2 } },
      { type: 'result', ok: true }
    ])
    expect(mocks.replaceWithDraft).toHaveBeenCalledWith('c1', { title: 'T' })
  })

  it('ends with a failure line and stores nothing when generation fails', async () => {
    const failure = { kind: 'invalid-output', message: 'bad' }
    mocks.generate.mockImplementation(async (_p, _s, options) => {
      options.onProgress({ kind: 'skeleton' })
      return { ok: false, failure }
    })

    expect(await lines(await post(GENERATE))).toEqual([
      { type: 'progress', step: { kind: 'skeleton' } },
      { type: 'result', ok: false, failure }
    ])
    expect(mocks.replaceWithDraft).not.toHaveBeenCalled()
  })

  it.each([
    ['locked', new ArcLockedError('The Arc is read-only')],
    ['invalid', new ArcValidationError('The title is required')]
  ])('reports a %s Arc as its own message, not a provider error', async (_n, error) => {
    mocks.generate.mockResolvedValue({ ok: true, arc: {} })
    mocks.replaceWithDraft.mockImplementation(() => {
      throw error
    })

    const result = (await lines(await post(GENERATE))).at(-1)

    expect(result).toEqual({
      type: 'result',
      ok: false,
      failure: { kind: 'invalid-output', message: (error as Error).message }
    })
  })

  it('reports an unexpected error as a provider error', async () => {
    mocks.generate.mockResolvedValue({ ok: true, arc: {} })
    mocks.replaceWithDraft.mockImplementation(() => {
      throw new Error('disk')
    })

    expect((await lines(await post(GENERATE))).at(-1)).toMatchObject({
      ok: false,
      failure: { kind: 'provider-error' }
    })
  })

  it('cancels generation when the request is aborted (Stop), and stores nothing', async () => {
    const request = new AbortController()
    mocks.generate.mockImplementation(
      (_p, _s, options) =>
        new Promise((resolve) =>
          options.signal.addEventListener('abort', () =>
            resolve({ ok: false, failure: { kind: 'cancelled', message: 'Stopped' } })
          )
        )
    )

    const response = await post(GENERATE, request.signal)
    const reading = response.text()
    await vi.waitFor(() => expect(mocks.generate).toHaveBeenCalled())
    request.abort()
    await reading

    expect(mocks.generate.mock.calls[0][2].signal.aborted).toBe(true)
    expect(mocks.replaceWithDraft).not.toHaveBeenCalled()
  })

  it('cancels generation when the client drops the response body', async () => {
    mocks.generate.mockImplementation(
      (_p, _s, options) =>
        new Promise((resolve) =>
          options.signal.addEventListener('abort', () =>
            resolve({ ok: false, failure: { kind: 'cancelled', message: 'Stopped' } })
          )
        )
    )

    const response = await post(GENERATE)
    await vi.waitFor(() => expect(mocks.generate).toHaveBeenCalled())
    await response.body?.cancel()

    expect(mocks.generate.mock.calls[0][2].signal.aborted).toBe(true)
  })

  it.each([
    ['conflict', { canGenerate: false }, 409],
    ['AI not configured', { port: null }, 503],
    ['reasoning model locked', { locked: true }, 503]
  ])('rejects %s with plain JSON before any stream', async (_n, over, status) => {
    Object.assign(mocks, over)

    const response = await post(GENERATE)

    expect(response.status).toBe(status)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(await response.json()).toHaveProperty('error')
    expect(mocks.generate).not.toHaveBeenCalled()
  })

  it('rejects an unavailable AI with plain JSON', async () => {
    mocks.unavailable = { kind: 'provider-error', message: 'down' }

    const response = await post(GENERATE)

    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ ok: false, failure: { message: 'down' } })
  })
})
