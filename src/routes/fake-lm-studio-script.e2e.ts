import { expect, test, type APIRequestContext } from '@playwright/test'

const FAKE_LM_STUDIO = 'http://127.0.0.1:1235'

// The answer queue is process-wide state in the fake server, so these tests must not overlap.
test.describe.configure({ mode: 'serial' })

async function script(request: APIRequestContext, answers: unknown[]) {
  const response = await request.post(`${FAKE_LM_STUDIO}/__control/answers`, {
    data: { answers, replace: true }
  })
  expect(response.ok()).toBe(true)
}

async function chat(request: APIRequestContext) {
  const response = await request.post(`${FAKE_LM_STUDIO}/v1/chat/completions`, {
    data: { model: 'fake-model', stream: true, messages: [{ role: 'user', content: 'I look.' }] }
  })
  return { status: response.status(), text: await response.text() }
}

const contentOf = (sse: string) =>
  sse
    .split('\n')
    .filter((line) => line.startsWith('data: ') && !line.includes('[DONE]'))
    .map((line) => JSON.parse(line.slice(6)).choices?.[0]?.delta?.content ?? '')
    .join('')

test('streams a scripted narration over SSE, in pieces', async ({ request }) => {
  await script(request, [{ content: 'A torch flickers in the hall.' }])

  const { status, text } = await chat(request)

  expect(status).toBe(200)
  expect(contentOf(text)).toBe('A torch flickers in the hall.')
  expect(text.match(/"content":"[^"]+"/g)?.length).toBeGreaterThan(1)
  expect(text).toContain('[DONE]')
})

test('scripts a request_roll tool call, then the follow-up narration', async ({ request }) => {
  await script(request, [
    { toolCalls: [{ name: 'request_roll', arguments: { kind: 'skill', key: 'stealth', dc: 12 } }] },
    { content: 'You slip by.' }
  ])

  const first = await chat(request)
  const second = await chat(request)

  expect(first.text).toContain('"name":"request_roll"')
  expect(first.text).toContain('"finish_reason":"tool_calls"')
  expect(contentOf(second.text)).toBe('You slip by.')
})

test('scripts a failure', async ({ request }) => {
  await script(request, [{ status: 503 }])

  const { status } = await chat(request)

  expect(status).toBe(503)
})
