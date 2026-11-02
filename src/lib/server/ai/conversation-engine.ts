import { chat } from '@tanstack/ai'
import { z } from 'zod'
import { REASONING_MODEL_MESSAGE } from '#lib/ai/status.ts'
import {
  estimatePromptTokens,
  KEEP_MESSAGES,
  estimateTokens,
  exceedsLimit,
  shouldCompact
} from '#lib/world/context.ts'
import type { createChatAdapter } from './adapter.ts'

/**
 * The shared Creation conversation engine. One turn: seed + history + dismissed notes +
 * message in, a short reply and a partial-seed proposal (or a typed failure) out. UI-free;
 * the model is reached only through the injected `ChatPort`, so tests drive it with
 * canned events.
 *
 * A consumer (World, Campaign) supplies a `ConversationConfig`: its system prompt, turn
 * schema, seed fields and seed prompt. Everything else is generic.
 *
 * Layering: `attemptTurn` is one model call classified into a `TurnResult`; `runTurn`
 * wraps it with the failure policy (one deadline, cancellation, one silent retry for bad
 * output). Context management sits between them: before the first attempt, `prepare`
 * may compact (one extra schema-constrained summary call, model-facing only), and the
 * success result carries the provider's `usage` and any new `compaction`.
 *
 * Compaction state is the client's: `summary` covers the first `summarizedCount`
 * messages of `history` (the full visible transcript), which are then not sent again.
 */

export const MAX_TOKENS = 600

export const SUMMARY_MAX = 1200
export const SUMMARY_MAX_TOKENS = 500

export const summarySchema = z.object({ summary: z.string().min(1).max(SUMMARY_MAX) })

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface TurnInput<F extends string = string> {
  /** The live seed card, including manual edits. */
  seed: Record<F, string>
  /** The full visible transcript so far, excluding `message`. */
  history: ChatMessage[]
  /** Proposals the user dismissed, so the model does not repeat them. */
  dismissed: { field: F; value: string }[]
  /** Proposals still awaiting a decision; feedback in `message` may be about these. */
  pending?: { field: F; value: string }[]
  message: string
  /**
   * Extra system prompts rebuilt by the server every turn (e.g. a Campaign's Worlds). They sit
   * after the seed prompt, never in the transcript or summary, and count toward the estimate.
   */
  extraSystemPrompts?: string[]
  /** Model-facing summary of the first `summarizedCount` messages of `history`. */
  summary?: string
  summarizedCount?: number
  /** The model's context window and the last response's total tokens, if known. */
  context?: { limit: number; lastUsedTokens?: number }
}

/** What a consumer plugs into the engine. */
export interface ConversationConfig<F extends string> {
  /** The conversation's system prompt (first system message of every turn). */
  systemPrompt: string
  /** The system prompt of the compaction summary call. */
  summaryPrompt: string
  /** `{ reply, proposals: { [field]?: string } }`; proposals are read for `fields` only. */
  turnSchema: z.ZodObject
  /** The seed fields a Proposal may target. */
  fields: readonly F[]
  fieldLabels: Record<F, string>
  /** Renders the live seed card for the model. */
  seedPrompt: (seed: Record<F, string>) => string
}

/** What the port receives; independent of any provider. */
export interface ChatRequest {
  systemPrompts: string[]
  messages: ChatMessage[]
  maxTokens: number
  threadId: string
  outputSchema: z.ZodObject
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
  kind:
    | 'provider-error'
    | 'invalid-output'
    | 'reasoning-model'
    | 'timeout'
    | 'cancelled'
    /** The conversation cannot fit the model's context; input is blocked until the user chooses. */
    | 'context-full'
    /** Found by the probe that precedes a send: LM Studio is down or lacks the model. */
    | 'not-connected'
    | 'model-unavailable'
    /** A Campaign's selected Worlds were archived or deleted; non-retryable, no model call is made. */
    | 'worlds-changed'
  message: string
}

export const TURN_TIMEOUT_MS = 60_000

/** Token counts the provider reported for one call. */
export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export interface Compaction {
  summary: string
  summarizedCount: number
}

export type TurnResult<F extends string = string> =
  | {
      ok: true
      reply: string
      proposals: Partial<Record<F, string>>
      usage?: TokenUsage
      /** Present when this turn compacted first: the client stores it. */
      compaction?: Compaction
    }
  | { ok: false; failure: TurnFailure }

export interface RunTurnOptions {
  /** Cancels the turn (the user pressed Stop). */
  signal?: AbortSignal
  /** The whole-turn deadline, silent retry included. Injectable for tests. */
  timeoutMs?: number
}

export type CompactResult = ({ ok: true } & Compaction) | { ok: false; failure: TurnFailure }

const DISMISSED_LIMIT = 20

function summaryPrompt(summary: string | undefined) {
  if (!summary) return null
  return `Summary of the earlier conversation (those messages are no longer shown):\n${summary}`
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

const ROLE_LABEL = { user: 'Player', assistant: 'Assistant' } as const

const TIMEOUT_FAILURE: Extract<TurnResult, { ok: false }> = {
  ok: false,
  failure: { kind: 'timeout', message: 'The model took too long to reply' }
}
const CANCELLED_FAILURE: Extract<TurnResult, { ok: false }> = {
  ok: false,
  failure: { kind: 'cancelled', message: 'The turn was stopped' }
}

const COMPACTION_FAILED: Extract<CompactResult, { ok: false }> = {
  ok: false,
  failure: {
    kind: 'context-full',
    message: 'The conversation is too long and could not be summarized'
  }
}

type SummaryAttempt =
  | { ok: true; summary: string }
  /** `retry`: the output was unusable, so one more attempt may help. */
  | { ok: false; failure: TurnFailure; retry: boolean }

/** One summary call, parsed. The caller decides whether to retry. */
async function summarizeOnce(port: ChatPort, request: ChatRequest): Promise<SummaryAttempt> {
  const call = await callModel(port, request)
  if (!call.ok) return { ...call, retry: call.failure.kind === 'invalid-output' }
  const parsed = summarySchema.safeParse(call.object)
  if (parsed.success && parsed.data.summary.trim()) {
    return { ok: true, summary: parsed.data.summary.trim() }
  }
  return { ok: false, failure: COMPACTION_FAILED.failure, retry: true }
}

export interface ConversationEngine<F extends string> {
  buildRequest(input: TurnInput<F>, signal: AbortSignal): ChatRequest
  runTurn(port: ChatPort, input: TurnInput<F>, options?: RunTurnOptions): Promise<TurnResult<F>>
  /** Manual "Compact now": the same compaction, under its own deadline and cancellation. */
  compactConversation(
    port: ChatPort,
    input: TurnInput<F>,
    options?: RunTurnOptions
  ): Promise<CompactResult>
}

export function createConversationEngine<F extends string>(
  config: ConversationConfig<F>
): ConversationEngine<F> {
  type Input = TurnInput<F>
  type Prepared =
    { ok: true; input: Input; compaction?: Compaction } | { ok: false; failure: TurnFailure }

  function dismissedPrompt(dismissed: Input['dismissed']) {
    if (dismissed.length === 0) return null
    const lines = dismissed
      .slice(-DISMISSED_LIMIT)
      .map((d) => `- ${config.fieldLabels[d.field]}: ${d.value.slice(0, 100)}`)
    return `The user dismissed these proposals; do not propose them again:\n${lines.join('\n')}`
  }

  function pendingPrompt(pending: NonNullable<Input['pending']>) {
    if (pending.length === 0) return null
    const lines = pending.map((p) => `- ${config.fieldLabels[p.field]}: ${p.value}`)
    return `These proposals are pending, not yet accepted. If the user's message is feedback on one, revise it by proposing a replacement for the same field:\n${lines.join('\n')}`
  }

  function buildRequest(input: Input, signal: AbortSignal): ChatRequest {
    const systemPrompts = [
      config.systemPrompt,
      config.seedPrompt(input.seed),
      ...(input.extraSystemPrompts ?? [])
    ]
    const summary = summaryPrompt(input.summary)
    if (summary) systemPrompts.push(summary)
    const dismissed = dismissedPrompt(input.dismissed)
    if (dismissed) systemPrompts.push(dismissed)
    const pending = pendingPrompt(input.pending ?? [])
    if (pending) systemPrompts.push(pending)
    return {
      systemPrompts,
      messages: [
        ...input.history.slice(input.summarizedCount ?? 0),
        { role: 'user', content: input.message }
      ],
      maxTokens: MAX_TOKENS,
      // chat() requires a non-empty threadId; nothing is persisted, so each turn is its own.
      threadId: crypto.randomUUID(),
      outputSchema: config.turnSchema,
      signal
    }
  }

  /** One model call, classified. Never rejects. */
  async function attemptTurn(
    port: ChatPort,
    input: Input,
    signal: AbortSignal
  ): Promise<TurnResult<F>> {
    const call = await callModel(port, buildRequest(input, signal))
    if (!call.ok) return call
    const { object, usage } = call

    const parsed = config.turnSchema.safeParse(object)
    if (!parsed.success) {
      return {
        ok: false,
        failure: { kind: 'invalid-output', message: 'The model did not return a usable reply' }
      }
    }

    const data = parsed.data as { reply: string; proposals: Partial<Record<F, string>> }
    const proposals: Partial<Record<F, string>> = {}
    for (const field of config.fields) {
      const value = data.proposals[field]?.trim()
      if (value && value !== input.seed[field]) proposals[field] = value
    }
    return { ok: true, reply: data.reply, proposals, ...(usage && { usage }) }
  }

  function summaryRequest(input: Input, older: ChatMessage[], signal: AbortSignal): ChatRequest {
    const sections: string[] = []
    if (input.summary) sections.push(`Previous summary:\n${input.summary}`)
    const dismissed = dismissedPrompt(input.dismissed)
    if (dismissed) sections.push(dismissed)
    sections.push(
      `Messages to summarize:\n${older.map((m) => `${ROLE_LABEL[m.role]}: ${m.content}`).join('\n')}`
    )
    return {
      systemPrompts: [config.summaryPrompt],
      messages: [{ role: 'user', content: sections.join('\n\n') }],
      maxTokens: SUMMARY_MAX_TOKENS,
      threadId: crypto.randomUUID(),
      outputSchema: summarySchema,
      signal
    }
  }

  /**
   * Summarizes everything but the last `KEEP_MESSAGES` messages (plus any earlier summary).
   * Unusable output gets one silent retry, then `context-full`: the caller blocks input.
   * Real failures (reasoning model, provider error) are reported as they are, unretried.
   * Nothing older than the tail is a no-op that returns the existing state unchanged.
   */
  async function compact(
    port: ChatPort,
    input: Input,
    signal: AbortSignal
  ): Promise<CompactResult> {
    const from = input.summarizedCount ?? 0
    const upTo = input.history.length - KEEP_MESSAGES
    if (upTo <= from) return { ok: true, summary: input.summary ?? '', summarizedCount: from }

    const request = summaryRequest(input, input.history.slice(from, upTo), signal)
    for (let attempt = 0; attempt < 2 && !signal.aborted; attempt++) {
      const result = await summarizeOnce(port, request)
      if (result.ok) return { ok: true, summary: result.summary, summarizedCount: upTo }
      if (!result.retry) return { ok: false, failure: result.failure }
    }
    return COMPACTION_FAILED
  }

  async function compactConversation(
    port: ChatPort,
    input: Input,
    options: RunTurnOptions = {}
  ): Promise<CompactResult> {
    const controller = new AbortController()
    let outcome: CompactResult | undefined
    const stop = (result: CompactResult) => {
      outcome ??= result
      controller.abort()
    }
    const stopped = new Promise<CompactResult>((resolve) =>
      controller.signal.addEventListener('abort', () => resolve(outcome!))
    )
    const onCancel = () => stop({ ok: false, failure: CANCELLED_FAILURE.failure })
    const timer = setTimeout(
      () => stop({ ok: false, failure: TIMEOUT_FAILURE.failure }),
      options.timeoutMs ?? TURN_TIMEOUT_MS
    )
    options.signal?.addEventListener('abort', onCancel)
    if (options.signal?.aborted) onCancel()
    try {
      if (controller.signal.aborted) return outcome!
      return await Promise.race([compact(port, input, controller.signal), stopped])
    } finally {
      clearTimeout(timer)
      options.signal?.removeEventListener('abort', onCancel)
    }
  }

  /**
   * Context management before a turn: compacts when the send would cross the threshold
   * and there is something older to summarize, then refuses a prompt that still does not
   * fit. Without `context` (no known limit) the turn is sent as is.
   */
  async function prepare(port: ChatPort, input: Input, signal: AbortSignal): Promise<Prepared> {
    const limit = input.context?.limit
    if (!limit) return { ok: true, input }

    const projected = Math.max(
      estimatePromptTokens(input),
      (input.context?.lastUsedTokens ?? 0) + estimateTokens(input.message)
    )
    let current = input
    let compaction: Compaction | undefined
    if (shouldCompact({ projected, limit })) {
      const result = await compact(port, input, signal)
      if (!result.ok) return result
      if (result.summarizedCount !== (input.summarizedCount ?? 0)) {
        compaction = { summary: result.summary, summarizedCount: result.summarizedCount }
        current = { ...input, ...compaction }
      }
    }
    // After compaction the old usage is stale, so only the estimate decides.
    const size = compaction ? estimatePromptTokens(current) : projected
    if (exceedsLimit({ projected: size, limit })) {
      return {
        ok: false,
        failure: {
          kind: 'context-full',
          message: "The conversation no longer fits the model's context"
        }
      }
    }
    return { ok: true, input: current, compaction }
  }

  /**
   * Failure policy around `attemptTurn`: one deadline for the whole turn (abort, no
   * retry), cancellation, and a single silent retry when the model's output was bad.
   * Reasoning-model, provider, timeout and cancel failures are never retried.
   */
  async function runTurn(
    port: ChatPort,
    input: Input,
    options: RunTurnOptions = {}
  ): Promise<TurnResult<F>> {
    const controller = new AbortController()
    let outcome: TurnResult<F> | undefined
    const stop = (result: TurnResult<F>) => {
      outcome ??= result
      controller.abort()
    }
    // Resolves when the turn is stopped, so a port that ignores its signal cannot hold us.
    const stopped = new Promise<TurnResult<F>>((resolve) =>
      controller.signal.addEventListener('abort', () => resolve(outcome!))
    )
    const onCancel = () => stop(CANCELLED_FAILURE)
    const timer = setTimeout(() => stop(TIMEOUT_FAILURE), options.timeoutMs ?? TURN_TIMEOUT_MS)
    options.signal?.addEventListener('abort', onCancel)
    if (options.signal?.aborted) onCancel()

    try {
      if (controller.signal.aborted) return outcome!
      // Without a known limit there is nothing to prepare: go straight to the model.
      let ready: Extract<Prepared, { ok: true }> = { ok: true, input }
      if (input.context?.limit) {
        const prepared: Prepared | TurnResult<F> = await Promise.race([
          prepare(port, input, controller.signal),
          stopped
        ])
        if (!('input' in prepared)) return prepared as TurnResult<F>
        ready = prepared
      }
      const run = async () => {
        if (controller.signal.aborted) return outcome!
        return Promise.race([attemptTurn(port, ready.input, controller.signal), stopped])
      }
      let result = await run()
      if (!result.ok && result.failure.kind === 'invalid-output') result = await run()
      return result.ok && ready.compaction ? { ...result, compaction: ready.compaction } : result
    } finally {
      clearTimeout(timer)
      options.signal?.removeEventListener('abort', onCancel)
    }
  }

  return { buildRequest, runTurn, compactConversation }
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
