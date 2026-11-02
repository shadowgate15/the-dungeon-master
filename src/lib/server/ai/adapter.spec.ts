import { chat } from '@tanstack/ai'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { startFakeLmStudio, type FakeLmStudio } from '#lib/testing/fake-lm-studio/server.ts'
import { createChatAdapter } from './adapter.ts'

let fake: FakeLmStudio

beforeEach(async () => {
  fake = await startFakeLmStudio({ model: 'qwen3-4b-2507' })
})

afterEach(async () => {
  await fake.close()
})

describe('chat adapter seam', () => {
  it('streams a strict json_schema structured output from LM Studio', async () => {
    const schema = z.object({ reply: z.string(), proposal: z.object({}) })
    fake.setChatContent({ reply: 'Hello, traveller.', proposal: {} })

    const stream = chat({
      adapter: createChatAdapter({ baseUrl: fake.baseUrl, model: 'qwen3-4b-2507' }),
      messages: [{ role: 'user', content: 'Hi' }],
      threadId: 'test-thread',
      outputSchema: schema,
      stream: true
    })

    let result: unknown
    for await (const event of stream) {
      const e = event as { type: string; name?: string; value?: { object?: unknown } }
      if (e.type === 'CUSTOM' && e.name === 'structured-output.complete') {
        result = e.value?.object
      }
    }

    expect(result).toEqual({ reply: 'Hello, traveller.', proposal: {} })
    const sent = fake.requests.find((r) => r.path === '/v1/chat/completions')?.body as {
      model: string
      response_format: { type: string }
    }
    expect(sent.model).toBe('qwen3-4b-2507')
    expect(sent.response_format.type).toBe('json_schema')
  })
})
