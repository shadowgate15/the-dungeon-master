import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { startFakeLmStudio, type FakeLmStudio } from '#lib/testing/fake-lm-studio/server.ts'
import { createChatAdapter } from './adapter.ts'
import { createChatPort, streamText, type ChatRequest, type TextEvent } from './port.ts'

let fake: FakeLmStudio
const port = () => createChatPort(createChatAdapter({ baseUrl: fake.baseUrl, model: 'm' }))

const request = (over: Partial<ChatRequest> = {}): ChatRequest => ({
  systemPrompts: ['You are the DM.'],
  messages: [{ role: 'user', content: 'I open the door.' }],
  maxTokens: 256,
  threadId: 't',
  signal: new AbortController().signal,
  ...over
})

async function collect(events: AsyncIterable<TextEvent>) {
  const out: TextEvent[] = []
  for await (const e of events) out.push(e)
  return out
}

const textOf = (events: TextEvent[]) =>
  events.flatMap((e) => (e.type === 'delta' ? [e.text] : [])).join('')

beforeEach(async () => {
  fake = await startFakeLmStudio({ model: 'm' })
})
afterEach(async () => {
  await fake.close()
})

describe('free-text streaming through the port', () => {
  it('streams a scripted narration as text deltas with no output schema', async () => {
    fake.queueAnswers({ content: 'The door creaks open.' })

    const events = await collect(streamText(port(), request()))

    expect(textOf(events)).toBe('The door creaks open.')
    expect(events.filter((e) => e.type === 'delta').length).toBeGreaterThan(1)
    expect(events.at(-1)).toMatchObject({ type: 'done' })
    const sent = fake.requests.find((r) => r.path === '/v1/chat/completions')?.body as {
      response_format?: unknown
    }
    expect(sent.response_format).toBeUndefined()
  })

  it('reports a provider failure as an error event', async () => {
    fake.queueAnswers({ status: 500, times: 3 })

    const events = await collect(streamText(port(), request()))

    expect(events.at(-1)).toMatchObject({ type: 'error', failure: { kind: 'provider-error' } })
  })

  it('reports a connection dropped mid-stream as an error event', async () => {
    fake.queueAnswers({ content: 'The door creaks open slowly.', abortAfterChunks: 1, times: 3 })

    const events = await collect(streamText(port(), request()))

    expect(events.at(-1)).toMatchObject({ type: 'error' })
  })

  it('stops the model call when the signal aborts', async () => {
    fake.queueAnswers({ content: 'Never arrives.', delayMs: 5000 })
    const controller = new AbortController()

    const pending = collect(streamText(port(), request({ signal: controller.signal })))
    await new Promise((r) => setTimeout(r, 100))
    controller.abort()
    await pending

    await expect.poll(() => fake.openChatConnections()).toBe(0)
  })

  it('runs a scripted tool call on a server tool and continues with its result', async () => {
    const calls: unknown[] = []
    fake.queueAnswers(
      { toolCalls: [{ name: 'request_roll', arguments: { kind: 'skill', key: 'stealth' } }] },
      { content: 'You slip past.' }
    )
    const tool = {
      name: 'request_roll',
      description: 'Ask for a roll',
      inputSchema: {
        type: 'object',
        properties: { kind: { type: 'string' }, key: { type: 'string' } },
        required: ['kind', 'key']
      },
      execute: (input: unknown) => {
        calls.push(input)
        return { ok: true }
      }
    }

    const events = await collect(streamText(port(), request({ tools: [tool] })))

    expect(calls).toEqual([{ kind: 'skill', key: 'stealth' }])
    expect(textOf(events)).toBe('You slip past.')
  })

  it('does not run a tool for an invalid tool call', async () => {
    const calls: unknown[] = []
    fake.queueAnswers(
      { toolCalls: [{ name: 'request_roll', arguments: '{not json' }] },
      { content: 'Carry on.' }
    )
    const tool = {
      name: 'request_roll',
      description: 'Ask for a roll',
      inputSchema: { type: 'object', properties: {} },
      execute: (input: unknown) => calls.push(input)
    }

    const events = await collect(streamText(port(), request({ tools: [tool] })))

    expect(calls).toEqual([])
    expect(events.at(-1)).toMatchObject({ type: 'done' })
  })
})
