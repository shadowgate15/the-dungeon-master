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

import { POST } from './+server.ts'

const post = (body: unknown, signal = new AbortController().signal) =>
  POST({
    request: { json: async () => body, signal },
    params: { id: 'c1' }
  } as never)

const lines = async (response: Response) =>
  (await response.text())
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l))

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

    const response = await post({ action: 'generate' })

    expect(response.headers.get('content-type')).toBe('application/x-ndjson')
    expect(await lines(response)).toEqual([
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

    expect(await lines(await post({ action: 'generate' }))).toEqual([
      { type: 'progress', step: { kind: 'skeleton' } },
      { type: 'result', ok: false, failure }
    ])
    expect(mocks.replaceWithDraft).not.toHaveBeenCalled()
  })

  it('passes the request signal so Stop cancels generation', async () => {
    mocks.generate.mockResolvedValue({ ok: true, arc: {} })
    const signal = new AbortController().signal

    await (await post({ action: 'generate' }, signal)).text()

    expect(mocks.generate.mock.calls[0][2].signal).toBe(signal)
  })

  it.each([
    ['conflict', { canGenerate: false }, 409],
    ['AI not configured', { port: null }, 503],
    ['reasoning model locked', { locked: true }, 503]
  ])('rejects %s with plain JSON before any stream', async (_n, over, status) => {
    Object.assign(mocks, over)

    const response = await post({ action: 'generate' })

    expect(response.status).toBe(status)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(await response.json()).toHaveProperty('error')
    expect(mocks.generate).not.toHaveBeenCalled()
  })

  it('rejects an unavailable AI with plain JSON', async () => {
    mocks.unavailable = { kind: 'provider-error', message: 'down' }

    const response = await post({ action: 'generate' })

    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ ok: false, failure: { message: 'down' } })
  })
})
