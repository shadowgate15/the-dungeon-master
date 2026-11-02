import { describe, expect, it } from 'vitest'
import { emptySeed } from '#lib/world/seed.ts'
import {
  compactConversation,
  runTurn,
  type ChatMessage,
  type ChatPort,
  type ChatRequest,
  type TurnInput
} from './world-conversation.ts'

/** Both calls share one port; the request's schema tells a summary call from a turn. */
function isSummaryRequest(request: ChatRequest) {
  return 'summary' in (request.outputSchema as { shape: object }).shape
}

const complete = (object: unknown) => [
  { type: 'CUSTOM', name: 'structured-output.complete', value: { object } },
  { type: 'RUN_FINISHED', threadId: 't', runId: 'r' }
]

const TURN = complete({ reply: 'Noted.', proposals: {} })
const SUMMARY = complete({ summary: 'The player wants a drowned, gloomy kingdom.' })
const BAD = [{ type: 'RUN_ERROR', message: 'bad', code: 'max_tokens' }]

/** Replays the n-th script for summary calls and for turn calls, independently. */
function scriptedPorts(scripts: { summary?: object[][]; turn?: object[][] }) {
  const requests: ChatRequest[] = []
  const counts = { summary: 0, turn: 0 }
  const port: ChatPort = async function* (request) {
    requests.push(request)
    const kind = isSummaryRequest(request) ? 'summary' : 'turn'
    const list = (kind === 'summary' ? scripts.summary : scripts.turn) ?? [TURN]
    for (const event of list[Math.min(counts[kind]++, list.length - 1)]) yield event
  }
  return {
    port,
    requests,
    summaryCalls: () => requests.filter(isSummaryRequest),
    turnCalls: () => requests.filter((r) => !isSummaryRequest(r))
  }
}

/** n messages alternating user/assistant, each `size` characters long. */
function transcript(n: number, size = 30): ChatMessage[] {
  return Array.from({ length: n }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `m${i} `.padEnd(size, '.')
  }))
}

const LIMIT = 1000
const input = (over: Partial<TurnInput> = {}): TurnInput => ({
  seed: { ...emptySeed(), name: 'Eldoria' },
  history: transcript(12),
  dismissed: [{ field: 'scale', value: 'planar' }],
  message: 'Make the magic rarer',
  ...over
})

/** A context at or above 80% of the limit: the next send must compact first. */
const nearlyFull = { limit: LIMIT, lastUsedTokens: 850 }

describe('automatic compaction', () => {
  it('does not compact below 80% of the limit', async () => {
    const { port, requests } = scriptedPorts({})

    const result = await runTurn(port, input({ context: { limit: LIMIT, lastUsedTokens: 400 } }))

    expect(result).toMatchObject({ ok: true })
    expect(requests).toHaveLength(1)
    expect(result).not.toHaveProperty('compaction')
  })

  it('compacts first when the next send would cross 80%, then answers the turn', async () => {
    const p = scriptedPorts({ summary: [SUMMARY] })

    const result = await runTurn(p.port, input({ context: nearlyFull }))

    expect(p.summaryCalls()).toHaveLength(1)
    expect(p.turnCalls()).toHaveLength(1)
    expect(p.requests[0]).toBe(p.summaryCalls()[0])
    expect(result).toMatchObject({
      ok: true,
      compaction: { summary: 'The player wants a drowned, gloomy kingdom.', summarizedCount: 6 }
    })
  })

  it('sends the summary, the live seed and only the last few turns verbatim', async () => {
    const history = transcript(12)
    const p = scriptedPorts({ summary: [SUMMARY] })

    await runTurn(p.port, input({ history, context: nearlyFull }))

    const [turn] = p.turnCalls()
    expect(turn.messages).toEqual([
      ...history.slice(6),
      { role: 'user', content: 'Make the magic rarer' }
    ])
    const system = turn.systemPrompts.join('\n')
    expect(system).toContain('The player wants a drowned, gloomy kingdom.')
    expect(system).toContain('Eldoria')
  })

  it('does not summarize again when nothing but the verbatim tail is left', async () => {
    const p = scriptedPorts({})

    const result = await runTurn(
      p.port,
      input({ history: transcript(4), context: { limit: LIMIT, lastUsedTokens: 850 } })
    )

    expect(p.summaryCalls()).toHaveLength(0)
    expect(result).toMatchObject({ ok: true })
  })

  it('applies an existing summary: summarized messages are not sent again', async () => {
    const history = transcript(8)
    const p = scriptedPorts({})

    await runTurn(p.port, input({ history, summary: 'Earlier gist.', summarizedCount: 4 }))

    const [turn] = p.turnCalls()
    expect(turn.messages).toHaveLength(5)
    expect(turn.messages[0]).toEqual(history[4])
    expect(turn.systemPrompts.join('\n')).toContain('Earlier gist.')
  })
})

describe('summary request', () => {
  it('is one schema-constrained call over the older messages, dismissed notes and prior summary', async () => {
    const history = transcript(14)
    const p = scriptedPorts({ summary: [SUMMARY] })

    await compactConversation(
      p.port,
      input({ history, summary: 'Earlier gist.', summarizedCount: 4 })
    )

    const [request] = p.summaryCalls()
    expect(p.requests).toHaveLength(1)
    const text = [...request.systemPrompts, ...request.messages.map((m) => m.content)].join('\n')
    // Messages 4..7 are newly summarized; 8..13 are the verbatim tail.
    expect(text).toContain('m4 ')
    expect(text).toContain('m7 ')
    expect(text).not.toContain('m8 ')
    expect(text).not.toContain('m3 ')
    expect(text).toContain('Earlier gist.')
    expect(text).toContain('planar')
    expect(text).toMatch(/intent|direction/i)
    expect(request.maxTokens).toBeLessThanOrEqual(600)
  })

  it('returns a bounded summary and how many messages it covers', async () => {
    const p = scriptedPorts({ summary: [SUMMARY] })

    const result = await compactConversation(p.port, input({ history: transcript(14) }))

    expect(result).toEqual({
      ok: true,
      summary: 'The player wants a drowned, gloomy kingdom.',
      summarizedCount: 8
    })
  })

  it('rejects a summary longer than the bound as bad output', async () => {
    const p = scriptedPorts({ summary: [complete({ summary: 'x'.repeat(5000) })] })

    const result = await compactConversation(p.port, input())

    expect(result).toMatchObject({ ok: false })
  })

  it('has nothing to do when only the verbatim tail exists', async () => {
    const p = scriptedPorts({})

    const result = await compactConversation(
      p.port,
      input({ history: transcript(4), summary: 'Gist.', summarizedCount: 0 })
    )

    expect(p.requests).toHaveLength(0)
    expect(result).toEqual({ ok: true, summary: 'Gist.', summarizedCount: 0 })
  })
})

describe('compaction failure', () => {
  it('retries a failed summary once, silently', async () => {
    const p = scriptedPorts({ summary: [BAD, SUMMARY] })

    const result = await runTurn(p.port, input({ context: nearlyFull }))

    expect(p.summaryCalls()).toHaveLength(2)
    expect(result).toMatchObject({ ok: true, compaction: { summarizedCount: 6 } })
  })

  it('blocks the turn when the summary fails twice, without calling the turn', async () => {
    const p = scriptedPorts({ summary: [BAD] })

    const result = await runTurn(p.port, input({ context: nearlyFull }))

    expect(result).toMatchObject({ ok: false, failure: { kind: 'context-full' } })
    expect(p.summaryCalls()).toHaveLength(2)
    expect(p.turnCalls()).toHaveLength(0)
  })

  it('blocks manual compaction the same way after one retry', async () => {
    const p = scriptedPorts({ summary: [BAD] })

    const result = await compactConversation(p.port, input())

    expect(result).toMatchObject({ ok: false, failure: { kind: 'context-full' } })
    expect(p.summaryCalls()).toHaveLength(2)
  })

  it('blocks when the prompt still exceeds the limit after compaction', async () => {
    // The verbatim tail alone is far over the limit, so no summary can save the turn.
    const history = [...transcript(6), ...transcript(6, 2000)]
    const p = scriptedPorts({ summary: [SUMMARY] })

    const result = await runTurn(p.port, input({ history, context: nearlyFull }))

    expect(result).toMatchObject({ ok: false, failure: { kind: 'context-full' } })
    expect(p.turnCalls()).toHaveLength(0)
  })

  it('blocks when nothing can be compacted and the prompt exceeds the limit', async () => {
    const p = scriptedPorts({})

    const result = await runTurn(
      p.port,
      input({ history: transcript(4, 3000), context: { limit: LIMIT } })
    )

    expect(result).toMatchObject({ ok: false, failure: { kind: 'context-full' } })
    expect(p.requests).toHaveLength(0)
  })

  it('does not retry a timeout during compaction', async () => {
    const requests: ChatRequest[] = []
    const port: ChatPort = async function* (request) {
      requests.push(request)
      await new Promise<void>((_, reject) =>
        request.signal.addEventListener('abort', () => reject(new Error('aborted')))
      )
      yield {}
    }

    const result = await runTurn(port, input({ context: nearlyFull }), { timeoutMs: 20 })

    expect(result).toMatchObject({ ok: false, failure: { kind: 'timeout' } })
    expect(requests).toHaveLength(1)
  })
})
