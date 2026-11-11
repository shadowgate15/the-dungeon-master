import { describe, expect, it } from 'vitest'
import type { TextEvent } from '../ai/port.ts'
import { turnEventsResponse } from './sse.ts'

async function* from(events: TextEvent[]) {
  for (const e of events) yield e
}

describe('turnEventsResponse', () => {
  it('streams narration as SSE data lines ending in RUN_FINISHED', async () => {
    const response = turnEventsResponse(
      from([
        { type: 'delta', text: 'You see ' },
        { type: 'delta', text: 'a gate.' },
        { type: 'done' }
      ]),
      new AbortController(),
      'thread-1'
    )

    expect(response.headers.get('content-type')).toContain('text/event-stream')
    const chunks = (await response.text())
      .split('\n\n')
      .filter((block) => block.startsWith('data: '))
      .map((block) => JSON.parse(block.slice(6)))
    expect(chunks.filter((c) => c.type === 'TEXT_MESSAGE_CONTENT').map((c) => c.delta)).toEqual([
      'You see ',
      'a gate.'
    ])
    expect(chunks.at(-1)).toMatchObject({ type: 'RUN_FINISHED' })
  })

  it('reports a failure as RUN_ERROR', async () => {
    const response = turnEventsResponse(
      from([{ type: 'error', failure: { kind: 'provider-error', message: 'boom' } }]),
      new AbortController(),
      'thread-1'
    )
    const text = await response.text()
    expect(text).toContain('"type":"RUN_ERROR"')
    expect(text).toContain('boom')
  })

  // The spike: a closed tab cancels the response body, and the helper must abort the shared
  // controller so the model call stops.
  it('aborts the shared controller when the client goes away mid-stream', async () => {
    const controller = new AbortController()
    async function* slow(): AsyncGenerator<TextEvent> {
      yield { type: 'delta', text: 'first ' }
      await new Promise((resolve) => setTimeout(resolve, 5000))
      yield { type: 'delta', text: 'never' }
    }
    const response = turnEventsResponse(slow(), controller, 'thread-1')
    const reader = response.body!.getReader()
    await reader.read() // RUN_STARTED, so the stream is live

    await reader.cancel() // what the server sees when the browser closes the connection

    expect(controller.signal.aborted).toBe(true)
  })
})
