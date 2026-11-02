import { describe, expect, it } from 'vitest'
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
})
