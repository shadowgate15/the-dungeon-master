import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  createConversationEngine,
  type ChatPort,
  type ChatRequest,
  type ConversationConfig,
  type TurnInput
} from './conversation-engine.ts'

/** A second consumer: different fields, prompt, schema and seed prompt. */
const FIELDS = ['title', 'hook'] as const
type Field = (typeof FIELDS)[number]

const config: ConversationConfig<Field> = {
  systemPrompt: 'You help shape a quest.',
  summaryPrompt: 'Summarize the quest talk.',
  turnSchema: z.object({
    reply: z.string(),
    proposals: z.object({ title: z.string().optional(), hook: z.string().optional() })
  }),
  fields: FIELDS,
  fieldLabels: { title: 'Title', hook: 'Hook' },
  seedPrompt: (seed) => `Quest card: ${seed.title || '(unset)'} / ${seed.hook || '(unset)'}`
}

function fakePort(events: object[]) {
  const requests: ChatRequest[] = []
  const port: ChatPort = async function* (request) {
    requests.push(request)
    for (const event of events) yield event
  }
  return { port, requests }
}

const complete = (object: unknown) => [
  { type: 'CUSTOM', name: 'structured-output.complete', value: { object } },
  { type: 'RUN_FINISHED', threadId: 't', runId: 'r' }
]

const input = (over: Partial<TurnInput<Field>> = {}): TurnInput<Field> => ({
  seed: { title: '', hook: '' },
  history: [],
  dismissed: [],
  message: 'Give me a quest',
  ...over
})

describe('createConversationEngine', () => {
  it('runs a turn with the consumer prompt, seed prompt and fields', async () => {
    const { port, requests } = fakePort(
      complete({ reply: 'Here.', proposals: { title: 'Lost Mine', hook: '' } })
    )
    const engine = createConversationEngine(config)

    const result = await engine.runTurn(port, input({ seed: { title: 'Old', hook: '' } }))

    expect(result).toEqual({ ok: true, reply: 'Here.', proposals: { title: 'Lost Mine' } })
    expect(requests[0].systemPrompts).toEqual([
      'You help shape a quest.',
      'Quest card: Old / (unset)'
    ])
  })

  it('compacts with the consumer summary prompt', async () => {
    const { port, requests } = fakePort(complete({ summary: 'They like mines.' }))
    const engine = createConversationEngine(config)
    const history = Array.from({ length: 10 }, (_, i) => ({
      role: (i % 2 ? 'assistant' : 'user') as 'user' | 'assistant',
      content: `m${i}`
    }))

    const result = await engine.compactConversation(port, input({ history }))

    expect(result).toEqual({ ok: true, summary: 'They like mines.', summarizedCount: 4 })
    expect(requests[0].systemPrompts).toEqual(['Summarize the quest talk.'])
  })
})
