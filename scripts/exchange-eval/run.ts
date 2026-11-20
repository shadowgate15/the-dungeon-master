// Runs the Exchange cases against the model LM Studio has loaded, in one mode, and writes the raw
// records to a JSON file. Not part of `pnpm test`: it needs a real LM Studio.
//
//   pnpm eval:exchange --model <id> [--mode schema|raw-schema|tools] [--runs 5] [--cases a,b]
//                      [--label x] [--temperature 0.7] [--think] [--out path]
//                      [--contract v1|v2-prompt|v2-flat|v2-resists] [--max-tokens n] [--no-effects]
//                      [--mode systemone [--no-examples]]
//
// Modes:
// - schema: the app's real port (createChatPort over createChatAdapter) with `outputSchema`, so a
//   pass means the app's own path works. TanStack AI sends this as `response_format: json_schema`
//   with `strict: true`, and widens every optional field to required-and-nullable on the way.
// - raw-schema: `response_format: json_schema` strict sent raw, with optional fields left optional.
// - tools: the same contract offered as one function tool with `tool_choice: "required"`, sent raw.
// - prompt-json: no wire constraint; the schema is given in the prompt and the JSON is read from the
//   final content. The only mode that works with thinking on: with a `response_format`, LM Studio
//   applies the grammar to the reasoning itself, so the JSON lands in `reasoning_content`.
// - systemone: a decision model (LM Studio's /v1/systemone) answering the v2 contract as typed
//   choice questions, one request per step (see systemone.ts). --no-examples drops the worked
//   examples from the outcome instructions. Temperature and --contract do not apply.
// --contract picks the prompt and schema variant (see CONTRACTS in contract.ts).
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
  adjudicationRequest,
  effectRequest,
  sceneState,
  toAdjudication,
  toEffect,
  type ChoiceAnswer,
  type SystemOneRequest
} from './systemone.ts'
import {
  CONTRACTS,
  adjudicationSchema,
  effectSchema,
  fromFlat,
  jsonSchemaOf,
  sceneContext,
  type ContractId,
  type Effect
} from './contract.ts'

export const BASE_URL = process.env.LM_STUDIO_BASE_URL ?? 'http://localhost:1234/v1'
const ADJUDICATION_MAX_TOKENS = 200
const EFFECT_MAX_TOKENS = 80

export type Mode = 'schema' | 'raw-schema' | 'tools' | 'prompt-json' | 'systemone'

export interface Wire {
  request?: Record<string, unknown>
  startedAt: number
  firstTokenAt?: number
  content: string
  reasoning: string
  toolArgs: string
  toolCalls: number
  finishReason?: string
  usage?: { completion_tokens?: number; completion_tokens_details?: { reasoning_tokens?: number } }
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
  completionTokens?: number
  reasoningTokens?: number
  /** systemone only: the model's confidence and probabilities per question. */
  confidence?: Record<string, number>
  probabilities?: Record<string, Record<string, number>>
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
  contract?: ContractId
  runs: number
  temperature: number
  think: boolean
  /** Extra sampling fields sent with every request (e.g. presence_penalty for thinking). */
  sampling?: Record<string, unknown>
  /** systemone only: whether the outcome instructions carried the worked examples. */
  examples?: boolean
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
      usage?: Wire['usage']
    }
    try {
      chunk = JSON.parse(json)
    } catch {
      return
    }
    if (chunk.usage) wire.usage = chunk.usage
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
  /** Maps a schema-valid object to the one scored (the flat Adjudication's code-side rules). */
  post?: (object: Record<string, unknown>) => { ok: boolean; object?: unknown; error?: string }
  toolName: string
  toolDescription: string
  maxTokens: number
  inject: Record<string, unknown>
}

function verdictFor(spec: RequestSpec, parsed: unknown) {
  const verdict = judge(spec.schema, parsed)
  return verdict.ok && spec.post ? spec.post(verdict.object as Record<string, unknown>) : verdict
}

function finish(wire: Wire, verdict: { ok: boolean; object?: unknown; error?: string }): Attempt {
  const completion = wire.usage?.completion_tokens
  const reasoning = wire.usage?.completion_tokens_details?.reasoning_tokens
  return {
    ...verdict,
    ...(completion !== undefined && { completionTokens: completion }),
    ...(reasoning !== undefined && { reasoningTokens: reasoning }),
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
  return finish(wire, verdictFor(spec, call.object))
}

/** Reads the JSON object out of free content: drops any fence and text around the outermost braces. */
function extractJson(content: string): string {
  const start = content.indexOf('{')
  const end = content.lastIndexOf('}')
  return start >= 0 && end > start ? content.slice(start, end + 1) : content
}

type Wiring = 'tools' | 'response_format' | 'prompt'

/** A raw streamed request: the contract as one required tool, as `response_format`, or in the prompt only. */
async function requestRaw(spec: RequestSpec, wiring: Wiring): Promise<Attempt> {
  const wire = begin(spec.inject)
  const tools = wiring === 'tools'
  const system =
    wiring === 'prompt'
      ? `${spec.system}\n\nReply with only the JSON object, no other text. It must match this JSON Schema:\n${JSON.stringify(jsonSchemaOf(spec.schema))}`
      : spec.system
  const contract =
    wiring === 'prompt'
      ? {}
      : tools
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
          { role: 'system', content: system },
          { role: 'user', content: spec.user }
        ],
        ...contract,
        max_tokens: spec.maxTokens,
        stream: true,
        stream_options: { include_usage: true }
      }),
      signal: AbortSignal.timeout(600_000)
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
  const answer = tools
    ? wire.toolArgs
    : wiring === 'prompt'
      ? extractJson(wire.content)
      : wire.content
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
    return finish(wire, {
      ok: false,
      error: wire.finishReason === 'length' ? 'hit max_tokens' : 'output is not JSON'
    })
  }
  return finish(wire, verdictFor(spec, parsed))
}

const SENDERS: Record<Exclude<Mode, 'systemone'>, (spec: RequestSpec) => Promise<Attempt>> = {
  schema: requestSchema,
  'raw-schema': (spec) => requestRaw(spec, 'response_format'),
  tools: (spec) => requestRaw(spec, 'tools'),
  'prompt-json': (spec) => requestRaw(spec, 'prompt')
}

/**
 * One decision-model request (see systemone.ts). Not streamed, so there is no TTFT. The answer is
 * valid when every choice is one of its criteria and the mapped object passes the contract schema.
 */
async function requestSystemOne(
  body: SystemOneRequest,
  toObject: (answers: Record<string, ChoiceAnswer>) => unknown,
  schema: z.ZodType
): Promise<Attempt> {
  const startedAt = performance.now()
  const totalMs = () => Math.round(performance.now() - startedAt)
  lastWire = body as unknown as Record<string, unknown>
  let text = ''
  try {
    const res = await realFetch(`${BASE_URL}/systemone`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000)
    })
    text = await res.text()
    if (!res.ok)
      return { ok: false, error: `http ${res.status}`, raw: text.slice(0, 400), totalMs: totalMs() }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      raw: text,
      totalMs: totalMs()
    }
  }
  const answers = (JSON.parse(text) as { answers?: Record<string, ChoiceAnswer> }).answers ?? {}
  const meta = {
    raw: JSON.stringify(Object.fromEntries(Object.entries(answers).map(([k, a]) => [k, a.choice]))),
    totalMs: totalMs(),
    confidence: Object.fromEntries(Object.entries(answers).map(([k, a]) => [k, a.confidence])),
    probabilities: Object.fromEntries(Object.entries(answers).map(([k, a]) => [k, a.probabilities]))
  }
  for (const [id, question] of Object.entries(body.questions)) {
    const choice = answers[id]?.choice
    if (choice === undefined || !(choice in question.criteria))
      return { ok: false, error: `${id}: no valid choice (${choice})`, ...meta }
  }
  return { ...judge(schema, toObject(answers)), ...meta }
}

// ---- the cell ---------------------------------------------------------------------------------

export interface CellOptions {
  label: string
  model: string
  mode: Mode
  contract?: ContractId
  runs: number
  temperature: number
  think: boolean
  sampling?: Record<string, unknown>
  /** Adjudication max_tokens; thinking needs far more than the default 200. */
  maxTokens?: number
  /** Run the Effect request too (default true). */
  effects?: boolean
  /** systemone only: put the fix-round worked examples in the outcome instructions (default true). */
  examples?: boolean
  memory?: string
  cases?: Case[]
  log?: (line: string) => void
}

export async function runCell(options: CellOptions): Promise<CellResult> {
  const cases = options.cases ?? CASES
  const contract = CONTRACTS[options.contract ?? 'v1']
  const inject = {
    temperature: options.temperature,
    ...options.sampling,
    ...(!options.think && { reasoning_effort: 'none' })
  }
  const records: CaseRecord[] = []
  let wire: Record<string, unknown> | undefined
  for (let run = 1; run <= options.runs; run++) {
    for (const c of cases) {
      const record =
        options.mode === 'systemone'
          ? await decisionCase(c, options)
          : await chatCase(c, options, contract, inject)
      wire ??= lastWire
      records.push({ caseId: c.id, run, ...record })
      const { adjudication, effect } = record
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
    contract: contract.id,
    runs: options.runs,
    temperature: options.temperature,
    think: options.think,
    ...(options.mode === 'systemone' && { examples: options.examples !== false }),
    ...(options.sampling && { sampling: options.sampling }),
    ...(options.memory && { memory: options.memory }),
    startedAt: new Date().toISOString(),
    ...(wire && { wire }),
    records
  }
}

type Step = { adjudication: Attempt; effect?: Attempt }

/** One case on a decision model: the v2 contract as typed questions, one request per step. */
async function decisionCase(c: Case, options: CellOptions): Promise<Step> {
  const state = sceneState(c.scene, CHARACTER, c.declaration)
  const adjudication = await requestSystemOne(
    adjudicationRequest(options.model, state, options.examples !== false),
    toAdjudication,
    adjudicationSchema
  )
  if (!c.effect || options.effects === false) return { adjudication }
  const effect = await requestSystemOne(
    effectRequest(options.model, c.scene, state),
    (answers) => toEffect(answers.effect.choice),
    effectSchema(c.scene)
  )
  return { adjudication, effect }
}

async function chatCase(
  c: Case,
  options: CellOptions,
  contract: (typeof CONTRACTS)[ContractId],
  inject: Record<string, unknown>
): Promise<Step> {
  const send = SENDERS[options.mode as Exclude<Mode, 'systemone'>]
  const user = sceneContext(c.scene, CHARACTER, c.declaration)
  const adjudication = await send({
    model: options.model,
    mode: options.mode,
    system: contract.adjudicationSystem,
    user,
    schema: contract.adjudicationWire,
    ...(contract.flat && { post: fromFlat }),
    toolName: 'adjudicate',
    toolDescription: 'Record how the player’s declaration resolves.',
    maxTokens: options.maxTokens ?? ADJUDICATION_MAX_TOKENS,
    inject
  })
  if (!c.effect || options.effects === false) return { adjudication }
  const effect = await send({
    model: options.model,
    mode: options.mode,
    system: contract.effectSystem,
    user,
    schema: effectSchema(c.scene),
    toolName: 'apply_effect',
    toolDescription: 'Record the one change to the scene the successful action causes.',
    maxTokens: EFFECT_MAX_TOKENS,
    inject
  })
  return { adjudication, effect }
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
  const contract = (arg('contract') ?? 'v1') as ContractId
  const only = arg('cases')?.split(',')
  const label = arg('label') ?? `${model}-${mode}`
  const result = await runCell({
    label,
    model,
    mode,
    contract,
    runs: Number(arg('runs') ?? 5),
    temperature: Number(arg('temperature') ?? 0.7),
    think: process.argv.includes('--think'),
    ...(arg('max-tokens') && { maxTokens: Number(arg('max-tokens')) }),
    ...(process.argv.includes('--no-effects') && { effects: false }),
    ...(process.argv.includes('--no-examples') && { examples: false }),
    cases: only ? CASES.filter((c) => only.includes(c.id)) : CASES,
    log: (line) => console.log(line)
  })
  const out =
    arg('out') ?? `scripts/exchange-eval/results/${label.replace(/[^a-zA-Z0-9.-]+/g, '_')}.json`
  writeResult(result, out)
  console.log(`Wrote ${out}`)
}
