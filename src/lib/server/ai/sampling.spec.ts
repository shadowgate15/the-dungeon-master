import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { startFakeLmStudio, type FakeLmStudio } from '#lib/testing/fake-lm-studio/server.ts'
import { createChatAdapter } from './adapter.ts'
import { resolveAiConfig } from './config.ts'
import { callModel, callText, createChatPort, type ChatRequest } from './port.ts'

let fake: FakeLmStudio

beforeEach(async () => {
  fake = await startFakeLmStudio({ model: 'm' })
})
afterEach(async () => {
  await fake.close()
})

const request = (over: Partial<ChatRequest> = {}): ChatRequest => ({
  systemPrompts: ['You are the referee.'],
  messages: [{ role: 'user', content: 'I open the door.' }],
  maxTokens: 64,
  threadId: 't',
  signal: new AbortController().signal,
  ...over
})

const sent = () =>
  fake.requests
    .filter((r) => r.path === '/v1/chat/completions')
    .map((r) => r.body as Record<string, unknown>)

describe('model settings', () => {
  it('default to temperature 0.7 with reasoning off', () => {
    expect(resolveAiConfig({ model: 'm' }).sampling).toEqual({
      temperature: 0.7,
      reasoningEffort: 'none'
    })
  })

  it('are sent with every structured and text request through the configured port', async () => {
    const config = resolveAiConfig({ baseUrl: fake.baseUrl, model: 'm' })
    const port = createChatPort(
      createChatAdapter({ baseUrl: config.baseUrl, model: 'm' }),
      config.sampling
    )
    fake.queueAnswers({ content: { outcome: 'happens' } }, { content: 'The door opens.' })

    await callModel(port, request({ outputSchema: z.object({ outcome: z.string() }) }))
    await callText(port, request())

    expect(sent()).toHaveLength(2)
    for (const body of sent()) {
      expect(body).toMatchObject({ temperature: 0.7, reasoning_effort: 'none', max_tokens: 64 })
    }
  })

  it('leave reasoning_effort off the request when none is set', async () => {
    const port = createChatPort(createChatAdapter({ baseUrl: fake.baseUrl, model: 'm' }), {
      temperature: 1
    })
    fake.queueAnswers({ content: 'The door opens.' })

    await callText(port, request())

    expect(sent()[0]).toMatchObject({ temperature: 1 })
    expect(sent()[0]).not.toHaveProperty('reasoning_effort')
  })
})
