// Runs the Exchange cases against the model LM Studio has loaded, in one mode, and writes the raw
// records to a JSON file. Not part of `pnpm test`: it needs a real LM Studio.
//
//   pnpm eval:exchange --model <id> [--mode schema|raw-schema|tools] [--runs 5] [--cases a,b]
//                      [--label x] [--temperature 0.7] [--think] [--out path]
//
// Modes:
// - schema: the app's real port (createChatPort over createChatAdapter) with `outputSchema`, so a
//   pass means the app's own path works. TanStack AI sends this as `response_format: json_schema`
//   with `strict: true`, and widens every optional field to required-and-nullable on the way.
// - raw-schema: `response_format: json_schema` strict sent raw, with optional fields left optional.
// - tools: the same contract offered as one function tool with `tool_choice: "required"`, sent raw.
// The first adjudication request body of the cell is recorded as `wire`.
//
// Every request goes through a fetch wrapper that times the first streamed token, keeps the raw
// streamed content (so failures can be quoted), and adds `temperature` and, unless --think,
// `reasoning_effort: "none"` to the body: the same as adding them to the port's `modelOptions`.
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { createChatAdapter } from '#lib/server/ai/adapter.ts'
import { callModel, createChatPort } from '#lib/server/ai/port.ts'
import type { z } from 'zod'
import { CASES, CHARACTER, type Case } from './cases.ts'
import {
  ADJUDICATION_SYSTEM,
  EFFECT_SYSTEM,
  adjudicationSchema,
  effectSchema,
  jsonSchemaOf,
  sceneContext,
  type Effect
} from './contract.ts'

export const BASE_URL = process.env.LM_STUDIO_BASE_URL ?? 'http://localhost:1234/v1'
const ADJUDICATION_MAX_TOKENS = 200
const EFFECT_MAX_TOKENS = 80

export type Mode = 'schema' | 'raw-schema' | 'tools'

export interface Wire {
  request?: Record<string, unknown>
  startedAt: number
  firstTokenAt?: number
  content: string
  reasoning: string
  toolArgs: string
  toolCalls: number
  finishReason?: string
}

export interface Attempt {
  ok: boolean
  /** The parsed object after nulls are dropped, when the output parsed as JSON. */
  object?: unknown
  /** Why the output is not schema-valid. */
  error?: string
  raw: string
  reasoning?: string
  ttftMs?: number
  totalMs: number
}

export interface CaseRecord {
  caseId: string
  run: number
  adjudication: Attempt
  effect?: Attempt
}

export interface CellResult {
  label: string
  model: string
  mode: Mode
  runs: number
  temperature: number
  think: boolean
  memory?: string
  startedAt: string
  wire?: Record<string, unknown>
  records: CaseRecord[]
}

// ---- fetch wrapper ---------------------------------------------------------------------------

let current: { wire: Wire; inject: Record<string, unknown>; done?: Promise<void> } | undefined
const realFetch = globalThis.fetch

async function consume(body: ReadableStream<Uint8Array>, wire: Wire) {
  const decoder = new TextDecoder()
  let buffer = ''
  const onChunk = (json: string) => {
    if (json === '[DONE]') return
    let chunk: {
      choices?: {
        delta?: {
          content?: string
          reasoning_content?: string
          tool_calls?: { index?: number; function?: { arguments?: string } }[]
        }
        message?: {
          content?: string
          reasoning_content?: string
          tool_calls?: { function?: { arguments?: string } }[]
        }
        finish_reason?: string
      }[]
    }
    try {
      chunk = JSON.parse(json)
    } catch {
      return
    }
    const choice = chunk.choices?.[0]
    const part = choice?.delta ?? choice?.message
    if (!part) return
    const text = (part.content ?? '') + (part.reasoning_content ?? '')
    const args = (part.tool_calls ?? []).map((t) => t.function?.arguments ?? '').join('')
    if ((text || args) && wire.firstTokenAt === undefined) wire.firstTokenAt = performance.now()
    wire.content += part.content ?? ''
    wire.reasoning += part.reasoning_content ?? ''
    for (const call of part.tool_calls ?? []) {
      const index = (call as { index?: number }).index ?? 0
      wire.toolCalls = Math.max(wire.toolCalls, index + 1)
      // Only the first tool call's arguments are the answer; later calls are recorded by count.
      if (index === 0) wire.toolArgs += call.function?.arguments ?? ''
    }
    if (choice?.finish_reason) wire.finishReason = choice.finish_reason
  }
  const reader = body.getReader()
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let nl: number
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim()
      buffer = buffer.slice(nl + 1)
      if (line.startsWith('data:')) onChunk(line.slice(5).trim())
    }
  }
  const rest = buffer.trim()
  if (rest.startsWith('data:')) onChunk(rest.slice(5).trim())
  else if (rest.startsWith('{')) onChunk(rest)
}

globalThis.fetch = async (input, init) => {
  const call = current
  let body = init?.body
  if (call && typeof body === 'string') {
    const parsed = { ...JSON.parse(body), ...call.inject }
    call.wire.request = parsed
    body = JSON.stringify(parsed)
  }
  const res = await realFetch(input, { ...init, body })
  if (!call || !res.body) return res
  const [forCaller, forUs] = res.body.tee()
  call.done = consume(forUs, call.wire)
  return new Response(forCaller, {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers
  })
}

function begin(inject: Record<string, unknown>): Wire {
  const wire: Wire = {
    startedAt: performance.now(),
    content: '',
    reasoning: '',
    toolArgs: '',
    toolCalls: 0
  }
  current = { wire, inject }
  return wire
}

async function end(): Promise<void> {
  await current?.done?.catch(() => undefined)
  current = undefined
}

// ---- one request in each mode -----------------------------------------------------------------

/** Drops `null` fields: strict OpenAI-style schemas send optional fields as required-nullable. */
function dropNulls(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== null))
}

function judge(
  schema: z.ZodType,
  parsed: unknown
): { ok: boolean; object?: unknown; error?: string } {
  const object = dropNulls(parsed)
  const result = schema.safeParse(object)
  return result.success
    ? { ok: true, object }
    : {
        ok: false,
        object,
        error: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
      }
}

interface RequestSpec {
  model: string
  mode: Mode
  system: string
  user: string
  schema: z.ZodObject
  toolName: string
  toolDescription: string
  maxTokens: number
  inject: Record<string, unknown>
}

function finish(wire: Wire, verdict: { ok: boolean; object?: unknown; error?: string }): Attempt {
  return {
    ...verdict,
    raw: wire.toolArgs || wire.content,
    ...(wire.reasoning && { reasoning: wire.reasoning.slice(0, 400) }),
    ...(wire.firstTokenAt !== undefined && {
      ttftMs: Math.round(wire.firstTokenAt - wire.startedAt)
    }),
    totalMs: Math.round(performance.now() - wire.startedAt)
  }
}

let lastWire: Record<string, unknown> | undefined

async function requestSchema(spec: RequestSpec): Promise<Attempt> {
  const port = createChatPort(createChatAdapter({ baseUrl: BASE_URL, model: spec.model }))
  const wire = begin(spec.inject)
  const call = await callModel(port, {
    systemPrompts: [spec.system],
    messages: [{ role: 'user', content: spec.user }],
    maxTokens: spec.maxTokens,
    threadId: 'exchange-eval',
    outputSchema: spec.schema,
    signal: AbortSignal.timeout(120_000)
  })
  await end()
  lastWire = wire.request
  if (!call.ok)
    return finish(wire, { ok: false, error: `${call.failure.kind}: ${call.failure.message}` })
  if (call.object === undefined) return finish(wire, { ok: false, error: 'no object' })
  return finish(wire, judge(spec.schema, call.object))
}

/** A raw streamed request; `tools` offers the contract as one required tool, else `response_format`. */
async function requestRaw(spec: RequestSpec, tools: boolean): Promise<Attempt> {
  const wire = begin(spec.inject)
  const contract = tools
    ? {
        tools: [
          {
            type: 'function',
            function: {
              name: spec.toolName,
              description: spec.toolDescription,
              parameters: jsonSchemaOf(spec.schema),
              strict: true
            }
          }
        ],
        tool_choice: 'required'
      }
    : {
        response_format: {
          type: 'json_schema',
          json_schema: { name: spec.toolName, strict: true, schema: jsonSchemaOf(spec.schema) }
        }
      }
  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer lm-studio' },
      body: JSON.stringify({
        model: spec.model,
        messages: [
          { role: 'system', content: spec.system },
          { role: 'user', content: spec.user }
        ],
        ...contract,
        max_tokens: spec.maxTokens,
        stream: true,
        stream_options: { include_usage: true }
      }),
      signal: AbortSignal.timeout(120_000)
    })
    if (!res.ok) {
      const text = await res.text()
      await end()
      return finish(wire, { ok: false, error: `http ${res.status}: ${text.slice(0, 200)}` })
    }
    await res.body?.cancel().catch(() => undefined)
  } catch (error) {
    await end()
    return finish(wire, {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    })
  }
  await end()
  lastWire = wire.request
  const answer = tools ? wire.toolArgs : wire.content
  if (!answer) {
    const missing = tools ? 'no tool call' : 'no content'
    return finish(wire, {
      ok: false,
      error:
        tools && wire.content
          ? 'prose instead of a tool call'
          : wire.reasoning
            ? `${missing} (reasoning only)`
            : missing
    })
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(answer)
  } catch {
    return finish(wire, { ok: false, error: 'output is not JSON' })
  }
  return finish(wire, judge(spec.schema, parsed))
}

const SENDERS: Record<Mode, (spec: RequestSpec) => Promise<Attempt>> = {
  schema: requestSchema,
  'raw-schema': (spec) => requestRaw(spec, false),
  tools: (spec) => requestRaw(spec, true)
}

// ---- the cell ---------------------------------------------------------------------------------

export interface CellOptions {
  label: string
  model: string
  mode: Mode
  runs: number
  temperature: number
  think: boolean
  memory?: string
  cases?: Case[]
  log?: (line: string) => void
}

export async function runCell(options: CellOptions): Promise<CellResult> {
  const cases = options.cases ?? CASES
  const inject = {
    temperature: options.temperature,
    ...(!options.think && { reasoning_effort: 'none' })
  }
  const send = SENDERS[options.mode]
  const records: CaseRecord[] = []
  let wire: Record<string, unknown> | undefined
  for (let run = 1; run <= options.runs; run++) {
    for (const c of cases) {
      const user = sceneContext(c.scene, CHARACTER, c.declaration)
      const adjudication = await send({
        model: options.model,
        mode: options.mode,
        system: ADJUDICATION_SYSTEM,
        user,
        schema: adjudicationSchema,
        toolName: 'adjudicate',
        toolDescription: 'Record how the player’s declaration resolves.',
        maxTokens: ADJUDICATION_MAX_TOKENS,
        inject
      })
      wire ??= lastWire
      const effect = c.effect
        ? await send({
            model: options.model,
            mode: options.mode,
            system: EFFECT_SYSTEM,
            user,
            schema: effectSchema(c.scene),
            toolName: 'apply_effect',
            toolDescription: 'Record the one change to the scene the successful action causes.',
            maxTokens: EFFECT_MAX_TOKENS,
            inject
          })
        : undefined
      records.push({ caseId: c.id, run, adjudication, ...(effect && { effect }) })
      const a = adjudication.object as { outcome?: string } | undefined
      const e = effect?.object as Effect | undefined
      options.log?.(
        `[${options.label}] run ${run} ${c.id}: ${adjudication.ok ? a?.outcome : `INVALID (${adjudication.error})`}` +
          (effect
            ? ` / ${effect.ok ? (e?.effect ?? '') + (e?.exitId ? `:${e.exitId}` : '') + (e?.npcId ? `:${e.npcId}` : '') : 'INVALID'}`
            : '') +
          ` ${adjudication.totalMs}ms`
      )
    }
  }
  return {
    label: options.label,
    model: options.model,
    mode: options.mode,
    runs: options.runs,
    temperature: options.temperature,
    think: options.think,
    ...(options.memory && { memory: options.memory }),
    startedAt: new Date().toISOString(),
    ...(wire && { wire }),
    records
  }
}

export function writeResult(result: CellResult, out: string) {
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`)
}

// ---- CLI --------------------------------------------------------------------------------------

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 ? process.argv[i + 1] : undefined
}

if (import.meta.main) {
  const model = arg('model')
  if (!model) {
    console.error(
      'Usage: pnpm eval:exchange --model <loaded model id> [--mode schema|tools] [--runs 5]'
    )
    process.exit(1)
  }
  const mode = (arg('mode') ?? 'schema') as Mode
  const only = arg('cases')?.split(',')
  const label = arg('label') ?? `${model}-${mode}`
  const result = await runCell({
    label,
    model,
    mode,
    runs: Number(arg('runs') ?? 5),
    temperature: Number(arg('temperature') ?? 0.7),
    think: process.argv.includes('--think'),
    cases: only ? CASES.filter((c) => only.includes(c.id)) : CASES,
    log: (line) => console.log(line)
  })
  const out =
    arg('out') ?? `scripts/exchange-eval/results/${label.replace(/[^a-zA-Z0-9.-]+/g, '_')}.json`
  writeResult(result, out)
  console.log(`Wrote ${out}`)
}
