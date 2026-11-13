import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'

/**
 * A fake LM Studio over real HTTP, so tests exercise the real adapter and probe.
 *
 * A scenario decides how the server answers. To add one (more failure modes,
 * ...) register another entry in `scenarios`; nothing else changes.
 * The active scenario can be switched while the server runs, either with `setScenario`
 * or by POSTing `{ "scenario": "..." }` to `/__control/scenario` (used by Playwright).
 * Chat completions answer, in order of precedence: the next entry of the FIFO answer queue
 * (POST `{ "answers": [{ "content": <json or raw string>, "delayMs"?: n }] }` to
 * `/__control/answers`, `"replace": true` clears it first), then a canned object set by POSTing
 * JSON to `/__control/chat-content` (the old chat's control), then a schema-aware default derived
 * from the request's `response_format` (first enum slug, a short string for text, minimum-length
 * arrays). An answer can also script `toolCalls` (a `request_roll`, or an invalid call with raw
 * `arguments`), `status` (an HTTP failure) or `abortAfterChunks` (the connection drops mid-stream).
 * Memory extraction calls (recognised by their system prompt marker) never touch that queue, so a
 * scripted DM scenario is not disturbed by the silent call after each turn. They take the next
 * entry of their own queue (POST the same answer shape to `/__control/extractions`, `"replace":
 * true` clears it first), or else the schema default: no changes.
 * POSTing `{ "ms": n }` to `/__control/delay` delays every response that has no delay of
 * its own. GET `/__control/requests` returns the chat requests received so far.
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
  /** The next answer for a chat completion: queued, canned, or derived from the schema. */
  nextAnswer(): Answer
}

/** One answer to a chat completion: a JSON value (or a raw string) and an optional delay. */
export interface Answer {
  content?: unknown
  delayMs?: number
  /** Answer with this HTTP error status and no stream (a failure). */
  status?: number
  /**
   * Queue this answer this many times (default 1). The OpenAI client retries a 5xx or a dropped
   * connection twice, so a scripted failure or abort needs `times: 3` to reach the caller.
   */
  times?: number
  /** Stream this many content chunks, then drop the connection (a mid-stream abort). */
  abortAfterChunks?: number
  /**
   * Tool calls the model makes instead of (or before) content. `arguments` is an object, sent
   * as its JSON, or a raw string sent as is (an invalid tool call, e.g. malformed JSON).
   */
  toolCalls?: { name: string; arguments: unknown }[]
}

type Schema = {
  type?: string | string[]
  enum?: unknown[]
  properties?: Record<string, Schema>
  required?: string[]
  items?: Schema
  minItems?: number
  minimum?: number
  anyOf?: Schema[]
}

/** The simplest value satisfying `schema`: the first enum slug, a short string, minimum arrays. */
export function defaultFor(schema: Schema | undefined): unknown {
  if (!schema) return null
  if (schema.enum?.length) return schema.enum[0]
  if (schema.anyOf?.length) {
    return defaultFor(schema.anyOf.find((s) => s.type !== 'null') ?? schema.anyOf[0])
  }
  const type = Array.isArray(schema.type) ? schema.type.find((t) => t !== 'null') : schema.type
  switch (type) {
    case 'object':
      return Object.fromEntries(
        Object.entries(schema.properties ?? {})
          .filter(([key]) => !schema.required || schema.required.includes(key))
          .map(([key, sub]) => [key, defaultFor(sub)])
      )
    case 'array':
      return Array.from({ length: schema.minItems ?? 0 }, () => defaultFor(schema.items))
    case 'string':
      return 'A fake value.'
    case 'integer':
    case 'number':
      return schema.minimum ?? 0
    case 'boolean':
      return false
    default:
      return null
  }
}

function requestSchema(body: unknown): Schema | undefined {
  const format = (body as { response_format?: { json_schema?: { schema?: Schema } } } | undefined)
    ?.response_format
  return format?.json_schema?.schema
}

/** Marks the memory extraction call's system prompt (mirrors `EXTRACTION_MARKER` on the server). */
const EXTRACTION_MARKER = 'MEMORY EXTRACTION'

const isExtraction = (body: unknown) =>
  JSON.stringify((body as { messages?: unknown } | undefined)?.messages ?? '').includes(
    EXTRACTION_MARKER
  )

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

/**
 * Streams `content` as Chat Completions SSE chunks, in a few pieces like a real model.
 * A `reasoning` text is streamed first as `reasoning_content`, as a reasoning model does.
 */
function streamChatCompletion(
  ctx: ScenarioContext,
  content: string,
  reasoning = '',
  delayMs = 0,
  script: Pick<Answer, 'abortAfterChunks' | 'toolCalls'> = {}
) {
  if (delayMs > 0) {
    // A client that gives up (Stop, timeout) before the delay ends gets nothing written.
    const timer = setTimeout(
      () => streamChatCompletion(ctx, content, reasoning, 0, script),
      delayMs
    )
    ctx.res.on('close', () => clearTimeout(timer))
    return
  }
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
  if (reasoning) delta({ reasoning_content: reasoning })
  const size = Math.max(1, Math.ceil(content.length / 3))
  let chunks = 0
  for (let i = 0; i < content.length; i += size) {
    if (script.abortAfterChunks !== undefined && chunks >= script.abortAfterChunks) {
      ctx.req.socket.destroy()
      return
    }
    delta({ content: content.slice(i, i + size) })
    chunks++
  }
  if (script.abortAfterChunks !== undefined && chunks >= script.abortAfterChunks) {
    ctx.req.socket.destroy()
    return
  }
  if (script.toolCalls?.length) {
    script.toolCalls.forEach((call, index) => {
      const args =
        typeof call.arguments === 'string' ? call.arguments : JSON.stringify(call.arguments)
      delta({
        tool_calls: [
          {
            index,
            id: `call_fake_${index}`,
            type: 'function',
            function: { name: call.name, arguments: args }
          }
        ]
      })
    })
    delta({}, 'tool_calls')
  } else {
    delta({}, 'stop')
  }
  const promptTokens = 10
  const completionTokens = 20
  write([], {
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens
    }
  })
  res.end('data: [DONE]\n\n')
}

export const scenarios: Record<string, Scenario> = {
  ready: (ctx) => {
    if (modelList(ctx, [ctx.options.model])) return
    if (ctx.path === '/v1/chat/completions') {
      const { content, delayMs, status, abortAfterChunks, toolCalls } = ctx.nextAnswer()
      if (status) return json(ctx.res, status, { error: { message: 'Scripted failure' } })
      const text =
        content === undefined ? '' : typeof content === 'string' ? content : JSON.stringify(content)
      return streamChatCompletion(ctx, text, '', delayMs, { abortAfterChunks, toolCalls })
    }
    json(ctx.res, 404, { error: 'not found' })
  },
  /** The model answers, but with JSON of the wrong shape for the requested schema. */
  'bad-output': (ctx) => {
    if (modelList(ctx, [ctx.options.model])) return
    if (ctx.path === '/v1/chat/completions') {
      return streamChatCompletion(ctx, JSON.stringify({ unexpected: 'wrong shape' }))
    }
    json(ctx.res, 404, { error: 'not found' })
  },
  /** Chat requests are accepted and then never answered, until the client gives up. */
  hang: (ctx) => {
    if (modelList(ctx, [ctx.options.model])) return
    if (ctx.path === '/v1/chat/completions') return
    json(ctx.res, 404, { error: 'not found' })
  },
  /** A reasoning model: it streams only reasoning and never any answer content. */
  'reasoning-model': (ctx) => {
    if (modelList(ctx, [ctx.options.model])) return
    if (ctx.path === '/v1/chat/completions') {
      return streamChatCompletion(ctx, '', 'Let me think about this world...')
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
  /** Append answers to the FIFO queue, consumed one per chat completion in the `ready` scenario. */
  queueAnswers(...answers: Answer[]): void
  /** Append answers to the queue memory extraction calls consume (valid, rejected, unparseable, failing). */
  queueExtractions(...answers: Answer[]): void
  /** Delay every response that has no delay of its own. */
  setDelay(ms: number): void
  /** Chat completion requests still open (not finished or dropped by the client). */
  openChatConnections(): number
  close(): Promise<void>
}

const expand = ({ times = 1, ...answer }: Answer): Answer[] =>
  Array.from({ length: times }, () => answer)

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
  let chatContent: unknown
  const requests: FakeRequest[] = []
  const queue: Answer[] = []
  const extractionQueue: Answer[] = []
  let delayMs = 0
  let openChat = 0

  const server: Server = createServer(async (req, res) => {
    const path = new URL(req.url ?? '/', 'http://fake').pathname
    const body = await readBody(req)

    if (path === '/__control/scenario' && req.method === 'POST') {
      const name = (body as { scenario?: string } | undefined)?.scenario
      if (!name || !(name in scenarios)) return json(res, 400, { error: 'unknown scenario' })
      scenario = name
      return json(res, 200, { scenario })
    }

    if (path === '/__control/requests') return json(res, 200, requests)
    if (path === '/__control/chat-content' && req.method === 'POST') {
      chatContent = body
      return json(res, 200, { ok: true })
    }

    if (path === '/__control/answers' && req.method === 'POST') {
      const data = body as { answers?: Answer[]; replace?: boolean } | undefined
      if (data?.replace) queue.length = 0
      queue.push(...(data?.answers ?? []).flatMap(expand))
      return json(res, 200, { queued: queue.length })
    }
    if (path === '/__control/extractions' && req.method === 'POST') {
      const data = body as { answers?: Answer[]; replace?: boolean } | undefined
      if (data?.replace) extractionQueue.length = 0
      extractionQueue.push(...(data?.answers ?? []).flatMap(expand))
      return json(res, 200, { queued: extractionQueue.length })
    }
    if (path === '/__control/delay' && req.method === 'POST') {
      delayMs = (body as { ms?: number } | undefined)?.ms ?? 0
      return json(res, 200, { ok: true })
    }

    requests.push({ method: req.method ?? 'GET', path, body })
    if (path === '/v1/chat/completions') {
      openChat++
      res.on('close', () => openChat--)
    }
    await scenarios[scenario]({
      req,
      res,
      path,
      body,
      options: resolved,
      nextAnswer: () => {
        if (isExtraction(body)) {
          const scripted = extractionQueue.shift()
          if (scripted) return { delayMs, ...scripted }
          return { content: defaultFor(requestSchema(body)), delayMs }
        }
        const queued = queue.shift()
        if (queued) return { delayMs, ...queued }
        const schema = requestSchema(body)
        const content =
          chatContent !== undefined
            ? chatContent
            : schema
              ? defaultFor(schema)
              : 'The Dungeon Master narrates.'
        return { content, delayMs }
      }
    })
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
    queueAnswers(...answers) {
      queue.push(...answers.flatMap(expand))
    },
    queueExtractions(...answers) {
      extractionQueue.push(...answers.flatMap(expand))
    },
    setDelay(ms) {
      delayMs = ms
    },
    openChatConnections: () => openChat,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections()
        server.close(() => resolve())
      })
  }
}
