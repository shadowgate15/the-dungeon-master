import { afterEach, describe, expect, it, vi } from 'vitest'
import { emptySeed } from '#lib/world/seed.ts'
import {
  createChatPort,
  runTurn,
  type ChatPort,
  type ChatRequest,
  type TurnInput
} from './world-conversation.ts'
import { startFakeLmStudio } from '#lib/testing/fake-lm-studio/server.ts'

/** A port that replays the event shapes TanStack AI's chat() emits. */
function fakePort(events: object[]) {
  const requests: ChatRequest[] = []
  const port: ChatPort = async function* (request) {
    requests.push(request)
    for (const event of events) yield event
  }
  return { port, requests }
}

/** A port whose n-th call replays the n-th script (the last one repeats). */
function scriptedPort(scripts: object[][]) {
  const requests: ChatRequest[] = []
  const port: ChatPort = async function* (request) {
    requests.push(request)
    for (const event of scripts[Math.min(requests.length, scripts.length) - 1]) yield event
  }
  return { port, requests }
}

/** A port that never produces an event and only ends when its request is aborted. */
function hangingPort() {
  const requests: ChatRequest[] = []
  const port: ChatPort = async function* (request) {
    requests.push(request)
    await new Promise<void>((_, reject) =>
      request.signal.addEventListener('abort', () => reject(new Error('aborted')))
    )
    yield {}
  }
  return { port, requests }
}

const runError = (code: string) => [{ type: 'RUN_ERROR', message: code, code }]

const complete = (object: unknown) => [
  { type: 'RUN_STARTED', threadId: 't', runId: 'r' },
  { type: 'TEXT_MESSAGE_CONTENT', delta: '{"reply"' },
  { type: 'CUSTOM', name: 'structured-output.complete', value: { object } },
  { type: 'RUN_FINISHED', threadId: 't', runId: 'r' }
]

const input = (over: Partial<TurnInput> = {}): TurnInput => ({
  seed: emptySeed(),
  history: [],
  dismissed: [],
  message: 'Draft me a world',
  ...over
})

describe('runTurn', () => {
  it('returns the reply and the proposed fields', async () => {
    const { port } = fakePort(
      complete({ reply: 'A start.', proposals: { name: 'Eldoria', scale: 'continent' } })
    )

    const result = await runTurn(port, input())

    expect(result).toEqual({
      ok: true,
      reply: 'A start.',
      proposals: { name: 'Eldoria', scale: 'continent' }
    })
  })

  it('sends the live seed, history, dismissed notes and message with a token cap and no tools', async () => {
    const { port, requests } = fakePort(complete({ reply: 'ok', proposals: {} }))

    await runTurn(
      port,
      input({
        seed: { ...emptySeed(), name: 'My Own Name', genreFlavor: 'mythic' },
        history: [
          { role: 'user', content: 'first message' },
          { role: 'assistant', content: 'first reply' }
        ],
        dismissed: [{ field: 'scale', value: 'planar' }],
        message: 'second message'
      })
    )

    const [request] = requests
    expect(request.messages).toEqual([
      { role: 'user', content: 'first message' },
      { role: 'assistant', content: 'first reply' },
      { role: 'user', content: 'second message' }
    ])
    const system = request.systemPrompts.join('\n')
    expect(system).toContain('My Own Name')
    expect(system).toContain('mythic')
    expect(system).toMatch(/dismissed/i)
    expect(system).toContain('planar')
    expect(request.maxTokens).toBe(600)
    expect(request.threadId).not.toBe('')
  })

  it('tells the model which proposals are still pending so feedback can revise them', async () => {
    const { port, requests } = fakePort(complete({ reply: 'ok', proposals: {} }))

    await runTurn(
      port,
      input({
        pending: [{ field: 'premise', value: 'A drowned kingdom.' }],
        message: 'make it darker'
      })
    )

    const system = requests[0].systemPrompts.join('\n')
    expect(system).toMatch(/pending/i)
    expect(system).toContain('A drowned kingdom.')
    expect(system).toMatch(/revise|replace/i)
  })

  it('drops proposals that are empty or equal to the current seed value', async () => {
    const { port } = fakePort(
      complete({
        reply: 'ok',
        proposals: { name: 'Same', premise: '', scale: 'continent', magicLevel: 'low' }
      })
    )

    const result = await runTurn(
      port,
      input({ seed: { ...emptySeed(), name: 'Same', magicLevel: 'none' } })
    )

    expect(result).toEqual({
      ok: true,
      reply: 'ok',
      proposals: { scale: 'continent', magicLevel: 'low' }
    })
  })

  it('fails with invalid-output when the model returns no structured result', async () => {
    const { port } = fakePort([{ type: 'RUN_FINISHED', threadId: 't', runId: 'r' }])

    const result = await runTurn(port, input())

    expect(result).toMatchObject({ ok: false, failure: { kind: 'invalid-output' } })
  })

  it('fails with invalid-output when the object breaks the schema', async () => {
    const { port } = fakePort(complete({ reply: 'x', proposals: { scale: 'galaxy' } }))

    const result = await runTurn(port, input())

    expect(result).toMatchObject({ ok: false, failure: { kind: 'invalid-output' } })
  })

  it('fails with provider-error on a RUN_ERROR event', async () => {
    const { port } = fakePort([{ type: 'RUN_ERROR', message: 'boom', code: 'x' }])

    const result = await runTurn(port, input())

    expect(result).toMatchObject({ ok: false, failure: { kind: 'provider-error' } })
  })

  it('fails with provider-error when the port throws', async () => {
    const port: ChatPort = () => {
      throw new Error('connection refused')
    }

    const result = await runTurn(port, input())

    expect(result).toMatchObject({ ok: false, failure: { kind: 'provider-error' } })
  })
})

describe('runTurn failure handling', () => {
  afterEach(() => vi.useRealTimers())

  const good = complete({ reply: 'Second time lucky.', proposals: { name: 'Eldoria' } })

  it('retries bad output once, silently, and returns the retry result', async () => {
    const { port, requests } = scriptedPort([
      complete({ reply: 'x', proposals: { scale: 'galaxy' } }),
      good
    ])

    const result = await runTurn(port, input())

    expect(result).toEqual({
      ok: true,
      reply: 'Second time lucky.',
      proposals: { name: 'Eldoria' }
    })
    expect(requests).toHaveLength(2)
  })

  it.each(['structured-output-validation-failed', 'structured-output-parse-failed', 'max_tokens'])(
    'treats the %s error as retryable bad output',
    async (code) => {
      const { port, requests } = scriptedPort([runError(code), good])

      expect(await runTurn(port, input())).toMatchObject({ ok: true })
      expect(requests).toHaveLength(2)
    }
  )

  it('fails with invalid-output after exactly one retry', async () => {
    const { port, requests } = scriptedPort([runError('max_tokens')])

    const result = await runTurn(port, input())

    expect(result).toMatchObject({ ok: false, failure: { kind: 'invalid-output' } })
    expect(requests).toHaveLength(2)
  })

  it('does not retry provider errors', async () => {
    const { port, requests } = scriptedPort([runError('server')])

    expect(await runTurn(port, input())).toMatchObject({
      ok: false,
      failure: { kind: 'provider-error' }
    })
    expect(requests).toHaveLength(1)
  })

  it('detects a reasoning model and does not retry', async () => {
    const { port, requests } = scriptedPort([runError('structured-output-missing-result')])

    const result = await runTurn(port, input())

    expect(result).toMatchObject({ ok: false, failure: { kind: 'reasoning-model' } })
    expect(requests).toHaveLength(1)
  })

  it('aborts after the timeout without retrying', async () => {
    vi.useFakeTimers()
    const { port, requests } = hangingPort()

    const pending = runTurn(port, input(), { timeoutMs: 60_000 })
    await vi.advanceTimersByTimeAsync(59_999)
    expect(requests[0].signal.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(1)

    expect(await pending).toMatchObject({ ok: false, failure: { kind: 'timeout' } })
    expect(requests).toHaveLength(1)
    expect(requests[0].signal.aborted).toBe(true)
  })

  it('times out after 60 seconds by default', async () => {
    vi.useFakeTimers()
    const { port } = hangingPort()

    const pending = runTurn(port, input())
    await vi.advanceTimersByTimeAsync(60_000)

    expect(await pending).toMatchObject({ ok: false, failure: { kind: 'timeout' } })
  })

  it('counts the silent retry against the same deadline', async () => {
    vi.useFakeTimers()
    let calls = 0
    const port: ChatPort = async function* (request) {
      calls++
      if (calls === 1) {
        yield* runError('max_tokens')
        return
      }
      await new Promise<void>((_, reject) =>
        request.signal.addEventListener('abort', () => reject(new Error('aborted')))
      )
    }

    const pending = runTurn(port, input(), { timeoutMs: 1000 })
    await vi.advanceTimersByTimeAsync(1000)

    expect(await pending).toMatchObject({ ok: false, failure: { kind: 'timeout' } })
    expect(calls).toBe(2)
  })

  it('cancels when the caller aborts, without retrying', async () => {
    const { port, requests } = hangingPort()
    const controller = new AbortController()

    const pending = runTurn(port, input(), { signal: controller.signal })
    controller.abort()

    expect(await pending).toMatchObject({ ok: false, failure: { kind: 'cancelled' } })
    expect(requests).toHaveLength(1)
    expect(requests[0].signal.aborted).toBe(true)
  })

  it('is cancelled without calling the port when already aborted', async () => {
    const { port, requests } = scriptedPort([good])

    const result = await runTurn(port, input(), { signal: AbortSignal.abort() })

    expect(result).toMatchObject({ ok: false, failure: { kind: 'cancelled' } })
    expect(requests).toHaveLength(0)
  })

  it('gives up on a port that ignores its abort signal', async () => {
    vi.useFakeTimers()
    const port: ChatPort = () => ({
      [Symbol.asyncIterator]: () => ({ next: () => new Promise(() => {}) })
    })

    const pending = runTurn(port, input(), { timeoutMs: 10 })
    await vi.advanceTimersByTimeAsync(10)

    expect(await pending).toMatchObject({ ok: false, failure: { kind: 'timeout' } })
  })
})

describe('createChatPort', () => {
  it('drives the real adapter against the fake LM Studio server', async () => {
    const fake = await startFakeLmStudio({ model: 'm' })
    try {
      fake.setChatContent({ reply: 'Hello.', proposals: { name: 'Eldoria' } })
      const { createChatAdapter } = await import('./adapter.ts')
      const port = createChatPort(createChatAdapter({ baseUrl: fake.baseUrl, model: 'm' }))

      const result = await runTurn(port, input())

      expect(result).toEqual({ ok: true, reply: 'Hello.', proposals: { name: 'Eldoria' } })
      const sent = fake.requests.find((r) => r.path === '/v1/chat/completions')?.body as {
        max_tokens?: number
        max_completion_tokens?: number
        tools?: unknown
      }
      expect(sent.max_tokens ?? sent.max_completion_tokens).toBe(600)
      expect(sent.tools).toBeUndefined()
    } finally {
      await fake.close()
    }
  })

  it('aborts the request to the server when the turn is cancelled', async () => {
    const fake = await startFakeLmStudio({ model: 'm', scenario: 'hang' })
    try {
      const { createChatAdapter } = await import('./adapter.ts')
      const port = createChatPort(createChatAdapter({ baseUrl: fake.baseUrl, model: 'm' }))
      const controller = new AbortController()

      const pending = runTurn(port, input(), { signal: controller.signal })
      await vi.waitFor(() => expect(fake.requests.length).toBeGreaterThan(0))
      controller.abort()

      expect(await pending).toMatchObject({ ok: false, failure: { kind: 'cancelled' } })
      await vi.waitFor(() => expect(fake.openChatConnections()).toBe(0))
    } finally {
      await fake.close()
    }
  })

  it('reports the reasoning-model scenario as such', async () => {
    const fake = await startFakeLmStudio({ model: 'm', scenario: 'reasoning-model' })
    try {
      const { createChatAdapter } = await import('./adapter.ts')
      const port = createChatPort(createChatAdapter({ baseUrl: fake.baseUrl, model: 'm' }))

      expect(await runTurn(port, input())).toMatchObject({
        ok: false,
        failure: { kind: 'reasoning-model' }
      })
      expect(fake.requests.filter((r) => r.path === '/v1/chat/completions')).toHaveLength(1)
    } finally {
      await fake.close()
    }
  })

  it('retries the bad-output scenario once and then fails', async () => {
    const fake = await startFakeLmStudio({ model: 'm', scenario: 'bad-output' })
    try {
      const { createChatAdapter } = await import('./adapter.ts')
      const port = createChatPort(createChatAdapter({ baseUrl: fake.baseUrl, model: 'm' }))

      expect(await runTurn(port, input())).toMatchObject({
        ok: false,
        failure: { kind: 'invalid-output' }
      })
      expect(fake.requests.filter((r) => r.path === '/v1/chat/completions')).toHaveLength(2)
    } finally {
      await fake.close()
    }
  })
})
