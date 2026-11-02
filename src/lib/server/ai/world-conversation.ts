import { chat } from '@tanstack/ai'
import { z } from 'zod'
import { REASONING_MODEL_MESSAGE } from '#lib/ai/status.ts'
import { GENRE_FLAVORS, MAGIC_LEVELS, SCALES, TECH_LEVELS } from '#lib/world/enums.ts'
import {
  FIELD_LABELS,
  NAME_MAX,
  PREMISE_MAX,
  REPLY_MAX,
  SEED_FIELDS,
  type Seed,
  type SeedField
} from '#lib/world/seed.ts'
import type { createChatAdapter } from './adapter.ts'

/**
 * One World creation conversation turn: seed + history + dismissed notes + message in,
 * a short reply and a partial-seed proposal (or a typed failure) out. UI-free; the model
 * is reached only through the injected `ChatPort`, so tests drive it with canned events.
 *
 * Layering: `attemptTurn` is one model call classified into a `TurnResult`; `runTurn`
 * wraps it with the failure policy (one deadline, cancellation, one silent retry for bad
 * output). #33 adds `usage` to the success result and a compaction step that rewrites
 * `history` before `buildRequest`; both belong in or around `attemptTurn`, not the policy.
 */

export const MAX_TOKENS = 600

export const turnSchema = z.object({
  reply: z.string().max(REPLY_MAX),
  proposals: z.object({
    name: z.string().max(NAME_MAX).optional(),
    premise: z.string().max(PREMISE_MAX).optional(),
    genreFlavor: z.enum(GENRE_FLAVORS).optional(),
    scale: z.enum(SCALES).optional(),
    magicLevel: z.enum(MAGIC_LEVELS).optional(),
    techLevel: z.enum(TECH_LEVELS).optional()
  })
})

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface TurnInput {
  /** The live seed card, including manual edits. */
  seed: Seed
  /** The full visible transcript so far, excluding `message`. */
  history: ChatMessage[]
  /** Proposals the user dismissed, so the model does not repeat them. */
  dismissed: { field: SeedField; value: string }[]
  /** Proposals still awaiting a decision; feedback in `message` may be about these. */
  pending?: { field: SeedField; value: string }[]
  message: string
}

/** What the port receives; independent of any provider. */
export interface ChatRequest {
  systemPrompts: string[]
  messages: ChatMessage[]
  maxTokens: number
  threadId: string
  outputSchema: typeof turnSchema
  /** Aborted on timeout or cancel; the port must stop the provider call when it fires. */
  signal: AbortSignal
}

/** Streams provider-neutral AG-UI style events for one request. */
export type ChatPort = (request: ChatRequest) => AsyncIterable<unknown>

/**
 * `invalid-output` (validation error or truncation) is the only retryable kind.
 * `reasoning-model` means the model produced no answer content at all.
 */
export type TurnFailure = {
  kind: 'provider-error' | 'invalid-output' | 'reasoning-model' | 'timeout' | 'cancelled'
  message: string
}

export const TURN_TIMEOUT_MS = 60_000

/** Token counts the provider reported for one call. */
export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export type TurnResult =
  | { ok: true; reply: string; proposals: Partial<Record<SeedField, string>>; usage?: TokenUsage }
  | { ok: false; failure: TurnFailure }

const SYSTEM_PROMPT = `You are helping a player create a fantasy World for a tabletop role-playing campaign.
Reply with a short message (a sentence or two) and a "proposals" object holding only the seed fields you want to change.
Seed fields: name (short text), premise (a few sentences), genreFlavor, scale, magicLevel, techLevel (each one of the allowed values).
Leave out fields you do not want to change. When the user gives feedback on a pending proposal, answer with a revised proposal for that same field.
Never repeat a proposal the user dismissed. Respect values the user already set unless asked to change them.`

function seedPrompt(seed: Seed) {
  const lines = (Object.keys(seed) as SeedField[]).map(
    (f) => `- ${FIELD_LABELS[f]}: ${seed[f] || '(unset)'}`
  )
  return `Current seed card (the user may have edited it):\n${lines.join('\n')}`
}

const DISMISSED_LIMIT = 20

function dismissedPrompt(dismissed: TurnInput['dismissed']) {
  if (dismissed.length === 0) return null
  const lines = dismissed
    .slice(-DISMISSED_LIMIT)
    .map((d) => `- ${FIELD_LABELS[d.field]}: ${d.value.slice(0, 100)}`)
  return `The user dismissed these proposals; do not propose them again:\n${lines.join('\n')}`
}

function pendingPrompt(pending: NonNullable<TurnInput['pending']>) {
  if (pending.length === 0) return null
  const lines = pending.map((p) => `- ${FIELD_LABELS[p.field]}: ${p.value}`)
  return `These proposals are pending, not yet accepted. If the user's message is feedback on one, revise it by proposing a replacement for the same field:\n${lines.join('\n')}`
}

export function buildRequest(input: TurnInput, signal: AbortSignal): ChatRequest {
  const systemPrompts = [SYSTEM_PROMPT, seedPrompt(input.seed)]
  const dismissed = dismissedPrompt(input.dismissed)
  if (dismissed) systemPrompts.push(dismissed)
  const pending = pendingPrompt(input.pending ?? [])
  if (pending) systemPrompts.push(pending)
  return {
    systemPrompts,
    messages: [...input.history, { role: 'user', content: input.message }],
    maxTokens: MAX_TOKENS,
    // chat() requires a non-empty threadId; nothing is persisted, so each turn is its own.
    threadId: crypto.randomUUID(),
    outputSchema: turnSchema,
    signal
  }
}

type Event = {
  type?: string
  usage?: unknown
  name?: string
  message?: string
  code?: string
  value?: { object?: unknown }
}

/** TanStack AI error codes for output the model produced but we cannot use. */
const BAD_OUTPUT_CODES = new Set([
  'structured-output-validation-failed',
  'structured-output-parse-failed',
  'max_tokens'
])
const REASONING_MODEL_CODE = 'structured-output-missing-result'

function runErrorFailure(event: Event): TurnFailure {
  const message = event.message ?? 'The model request failed'
  if (event.code === REASONING_MODEL_CODE) {
    return { kind: 'reasoning-model', message: REASONING_MODEL_MESSAGE }
  }
  if (event.code && BAD_OUTPUT_CODES.has(event.code)) return { kind: 'invalid-output', message }
  return { kind: 'provider-error', message }
}

const num = (value: unknown) => (typeof value === 'number' ? value : 0)

/**
 * `RUN_FINISHED.usage` is either AG-UI's `usage[]` (inputTokens/outputTokens) or
 * TanStack's own shape (promptTokens/completionTokens); both are read here.
 */
function readUsage(raw: unknown): TokenUsage | undefined {
  const u = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | undefined
  if (!u || typeof u !== 'object') return undefined
  const promptTokens = num(u.promptTokens ?? u.inputTokens)
  const completionTokens = num(u.completionTokens ?? u.outputTokens)
  const totalTokens = num(u.totalTokens) || promptTokens + completionTokens
  return totalTokens > 0 ? { promptTokens, completionTokens, totalTokens } : undefined
}

type ModelCall =
  { ok: true; object: unknown; usage?: TokenUsage } | { ok: false; failure: TurnFailure }

/** One streamed model call: the structured object and usage, or a typed failure. */
async function callModel(port: ChatPort, request: ChatRequest): Promise<ModelCall> {
  let object: unknown
  let usage: TokenUsage | undefined
  try {
    for await (const raw of port(request)) {
      const event = raw as Event
      if (event.type === 'RUN_ERROR') return { ok: false, failure: runErrorFailure(event) }
      if (event.type === 'RUN_FINISHED') usage = readUsage(event.usage) ?? usage
      if (event.type === 'CUSTOM' && event.name === 'structured-output.complete') {
        object = event.value?.object
      }
    }
  } catch (error) {
    return {
      ok: false,
      failure: {
        kind: 'provider-error',
        message: error instanceof Error ? error.message : 'The model request failed'
      }
    }
  }
  return { ok: true, object, usage }
}

/** One model call, classified. Never rejects. */
async function attemptTurn(
  port: ChatPort,
  input: TurnInput,
  signal: AbortSignal
): Promise<TurnResult> {
  const call = await callModel(port, buildRequest(input, signal))
  if (!call.ok) return call
  const { object, usage } = call

  const parsed = turnSchema.safeParse(object)
  if (!parsed.success) {
    return {
      ok: false,
      failure: { kind: 'invalid-output', message: 'The model did not return a usable reply' }
    }
  }

  const proposals: Partial<Record<SeedField, string>> = {}
  for (const field of SEED_FIELDS) {
    const value = parsed.data.proposals[field]?.trim()
    if (value && value !== input.seed[field]) proposals[field] = value
  }
  return { ok: true, reply: parsed.data.reply, proposals, ...(usage && { usage }) }
}

export interface RunTurnOptions {
  /** Cancels the turn (the user pressed Stop). */
  signal?: AbortSignal
  /** The whole-turn deadline, silent retry included. Injectable for tests. */
  timeoutMs?: number
}

const TIMEOUT_FAILURE: TurnResult = {
  ok: false,
  failure: { kind: 'timeout', message: 'The model took too long to reply' }
}
const CANCELLED_FAILURE: TurnResult = {
  ok: false,
  failure: { kind: 'cancelled', message: 'The turn was stopped' }
}

/**
 * Failure policy around `attemptTurn`: one deadline for the whole turn (abort, no
 * retry), cancellation, and a single silent retry when the model's output was bad.
 * Reasoning-model, provider, timeout and cancel failures are never retried.
 */
export async function runTurn(
  port: ChatPort,
  input: TurnInput,
  options: RunTurnOptions = {}
): Promise<TurnResult> {
  const controller = new AbortController()
  let outcome: TurnResult | undefined
  const stop = (result: TurnResult) => {
    outcome ??= result
    controller.abort()
  }
  // Resolves when the turn is stopped, so a port that ignores its signal cannot hold us.
  const stopped = new Promise<TurnResult>((resolve) =>
    controller.signal.addEventListener('abort', () => resolve(outcome!))
  )
  const onCancel = () => stop(CANCELLED_FAILURE)
  const timer = setTimeout(() => stop(TIMEOUT_FAILURE), options.timeoutMs ?? TURN_TIMEOUT_MS)
  options.signal?.addEventListener('abort', onCancel)
  if (options.signal?.aborted) onCancel()

  try {
    const run = async () => {
      if (controller.signal.aborted) return outcome!
      return Promise.race([attemptTurn(port, input, controller.signal), stopped])
    }
    const first = await run()
    if (first.ok || first.failure.kind !== 'invalid-output') return first
    return await run()
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', onCancel)
  }
}

/** The production port: TanStack AI `chat()` over the configured adapter. */
export function createChatPort(adapter: ReturnType<typeof createChatAdapter>): ChatPort {
  return (request) => {
    // chat() takes a controller, not a signal: relay ours so aborting cancels the fetch.
    const abortController = new AbortController()
    if (request.signal.aborted) abortController.abort()
    else request.signal.addEventListener('abort', () => abortController.abort(), { once: true })
    return chat({
      adapter,
      systemPrompts: request.systemPrompts,
      messages: request.messages,
      threadId: request.threadId,
      outputSchema: request.outputSchema,
      // The cap goes through the adapter's model options, not the top-level option.
      modelOptions: { max_tokens: request.maxTokens },
      stream: true,
      abortController
    }) as AsyncIterable<unknown>
  }
}
