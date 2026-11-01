import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'

/**
 * A fake LM Studio over real HTTP, so tests exercise the real adapter and probe.
 *
 * A scenario decides how the server answers. To add one (bad-output, hang,
 * reasoning-model, ...) register another entry in `scenarios`; nothing else changes.
 * The active scenario can be switched while the server runs, either with `setScenario`
 * or by POSTing `{ "scenario": "..." }` to `/__control/scenario` (used by Playwright).
 */

export interface FakeRequest {
  method: string
  path: string
  body: unknown
}

export interface FakeLmStudioOptions {
  /** The model id the server considers installed in the `ready` scenario. */
  model?: string
  /** The context length reported for the loaded model. */
  contextLength?: number
  /** The scenario to start in. */
  scenario?: string
}

export interface ScenarioContext {
  req: IncomingMessage
  res: ServerResponse
  path: string
  body: unknown
  options: { model: string; contextLength: number }
  /** The canned structured-output object that chat completions stream back. */
  chatContent: unknown
}

export type Scenario = (ctx: ScenarioContext) => void | Promise<void>

function json(res: ServerResponse, status: number, payload: unknown) {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(payload))
}

/** Answers the two model-listing endpoints; returns false for any other path. */
function modelList(ctx: ScenarioContext, ids: string[]): boolean {
  if (ctx.path === '/v1/models') {
    json(ctx.res, 200, {
      object: 'list',
      data: ids.map((id) => ({ id, object: 'model', owned_by: 'organization_owner' }))
    })
    return true
  }
  if (ctx.path === '/api/v0/models') {
    json(ctx.res, 200, {
      object: 'list',
      data: ids.map((id) => ({
        id,
        object: 'model',
        type: 'llm',
        state: 'loaded',
        max_context_length: ctx.options.contextLength * 8,
        loaded_context_length: ctx.options.contextLength
      }))
    })
    return true
  }
  return false
}

/** Streams `content` as Chat Completions SSE chunks, in a few pieces like a real model. */
function streamChatCompletion(ctx: ScenarioContext, content: string) {
  const { res } = ctx
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' })
  const write = (choices: object[], extra: object = {}) =>
    res.write(
      `data: ${JSON.stringify({
        id: 'chatcmpl-fake',
        object: 'chat.completion.chunk',
        created: 0,
        model: ctx.options.model,
        choices,
        ...extra
      })}\n\n`
    )
  const delta = (d: object, finish: string | null = null) =>
    write([{ index: 0, delta: d, finish_reason: finish }])

  delta({ role: 'assistant', content: '' })
  const size = Math.max(1, Math.ceil(content.length / 3))
  for (let i = 0; i < content.length; i += size) delta({ content: content.slice(i, i + size) })
  delta({}, 'stop')
  write([], { usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 } })
  res.end('data: [DONE]\n\n')
}

export const scenarios: Record<string, Scenario> = {
  ready: (ctx) => {
    if (modelList(ctx, [ctx.options.model])) return
    if (ctx.path === '/v1/chat/completions') {
      return streamChatCompletion(ctx, JSON.stringify(ctx.chatContent))
    }
    json(ctx.res, 404, { error: 'not found' })
  },
  /** LM Studio is running but the configured model is not installed. */
  'model-missing': (ctx) => {
    if (modelList(ctx, ['some-other-model'])) return
    json(ctx.res, 404, { error: 'not found' })
  },
  /** Nothing answers: connections are reset, as with LM Studio not running. */
  unreachable: (ctx) => {
    ctx.req.socket.destroy()
  }
}

export interface FakeLmStudio {
  /** The OpenAI-compatible base URL, e.g. http://127.0.0.1:1234/v1. */
  baseUrl: string
  /** The requests received so far, newest last (control requests excluded). */
  requests: FakeRequest[]
  setScenario(name: string): void
  /** Replace the object that chat completions stream back in the `ready` scenario. */
  setChatContent(content: unknown): void
  close(): Promise<void>
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  const text = Buffer.concat(chunks).toString('utf8')
  if (!text) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export async function startFakeLmStudio(
  options: FakeLmStudioOptions & { port?: number } = {}
): Promise<FakeLmStudio> {
  const resolved = {
    model: options.model ?? 'fake-model',
    contextLength: options.contextLength ?? 4096
  }
  let scenario = options.scenario ?? 'ready'
  let chatContent: unknown = { reply: 'A fake reply.', proposal: {} }
  const requests: FakeRequest[] = []

  const server: Server = createServer(async (req, res) => {
    const path = new URL(req.url ?? '/', 'http://fake').pathname
    const body = await readBody(req)

    if (path === '/__control/scenario' && req.method === 'POST') {
      const name = (body as { scenario?: string } | undefined)?.scenario
      if (!name || !(name in scenarios)) return json(res, 400, { error: 'unknown scenario' })
      scenario = name
      return json(res, 200, { scenario })
    }

    requests.push({ method: req.method ?? 'GET', path, body })
    await scenarios[scenario]({ req, res, path, body, options: resolved, chatContent })
  })

  await new Promise<void>((resolve) => server.listen(options.port ?? 0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo

  return {
    baseUrl: `http://127.0.0.1:${port}/v1`,
    requests,
    setScenario(name) {
      if (!(name in scenarios)) throw new Error(`Unknown scenario: ${name}`)
      scenario = name
    },
    setChatContent(content) {
      chatContent = content
    },
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections()
        server.close(() => resolve())
      })
  }
}
