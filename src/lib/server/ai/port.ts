import { chat, toolDefinition } from '@tanstack/ai'
import { z } from 'zod'
import { REASONING_MODEL_MESSAGE } from '#lib/ai/status.ts'
import type { createChatAdapter } from './adapter.ts'

/**
 * The neutral chat port: provider-neutral request and event types, the usage reader, one
 * classified model call, and the production port over TanStack AI. Used by
 * per-field generation.
 */

/** The failures a single model call can report; callers add their own kinds around these. */
export interface ModelFailure {
  kind: 'provider-error' | 'invalid-output' | 'reasoning-model'
  message: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

/**
 * A tool the model may call during a turn. `execute` is server code with no arguments from the
 * model; its return value goes back to the model. Provider-neutral: the port adapts it.
 */
export interface ChatTool {
  name: string
  description: string
  /** JSON Schema of the arguments the model passes; absent for a tool that takes none. */
  inputSchema?: Record<string, unknown>
  execute: (input: unknown) => unknown
  /**
   * The run pauses when the model calls this tool, after its input is validated against
   * `inputSchema`, and `execute` never runs: the caller sees an `approval-requested` event and
   * decides what the approval means. Invalid input is rejected to the model instead.
   */
  needsApproval?: boolean
}

/** What the port receives; independent of any provider. */
export interface ChatRequest {
  systemPrompts: string[]
  messages: ChatMessage[]
  maxTokens: number
  threadId: string
  /** Present for structured output (per-field AI); absent to stream free text. */
  outputSchema?: z.ZodObject
  /** Tools the model may call before answering; absent when none are offered. */
  tools?: ChatTool[]
  /** Aborted on timeout or cancel; the port must stop the provider call when it fires. */
  signal: AbortSignal
}

/** Streams provider-neutral AG-UI style events for one request. */
export type ChatPort = (request: ChatRequest) => AsyncIterable<unknown>

/** Token counts the provider reported for one call. */
export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
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

function runErrorFailure(event: Event): ModelFailure {
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
export function readUsage(raw: unknown): TokenUsage | undefined {
  const u = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | undefined
  if (!u || typeof u !== 'object') return undefined
  const promptTokens = num(u.promptTokens ?? u.inputTokens)
  const completionTokens = num(u.completionTokens ?? u.outputTokens)
  const totalTokens = num(u.totalTokens) || promptTokens + completionTokens
  return totalTokens > 0 ? { promptTokens, completionTokens, totalTokens } : undefined
}

export type ModelCall =
  { ok: true; object: unknown; usage?: TokenUsage } | { ok: false; failure: ModelFailure }

/** One streamed model call: the structured object and usage, or a typed failure. */
export async function callModel(port: ChatPort, request: ChatRequest): Promise<ModelCall> {
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

/** The TanStack AG-UI fields streamText reads off tool-call and interrupt events. */
type ToolEvent = {
  delta?: string
  toolCallId?: string
  input?: unknown
  content?: string
  metadata?: { tanstack?: { toolCallName?: string; state?: string } }
  outcome?: { type?: string; interrupts?: { toolCallId?: string }[] }
}

function toolErrorMessage(content: string | undefined): string {
  try {
    const parsed = JSON.parse(content ?? '') as { error?: unknown }
    if (typeof parsed.error === 'string') return parsed.error
  } catch {
    // not JSON: fall through to the raw content
  }
  return content ?? 'The tool call was rejected'
}

/** One step of a free-text model call, as the caller sees it. */
export type TextEvent =
  | { type: 'delta'; text: string }
  /** A `needsApproval` tool was called with valid input and the run paused on it. */
  | { type: 'approval-requested'; toolName: string; input: unknown }
  /** A tool call failed validation (or parsing); the error went back to the model. */
  | { type: 'tool-rejected'; toolName: string; message: string }
  | { type: 'done'; usage?: TokenUsage }
  | { type: 'error'; failure: ModelFailure }

/**
 * One free-text model call (no output schema): the narration as text deltas, then `done`, or a
 * final `error`. Tool calls run inside the port; only the text reaches the caller. Aborting the
 * request signal stops the provider call and ends the stream without a `done` or `error`.
 */
export async function* streamText(port: ChatPort, request: ChatRequest): AsyncGenerator<TextEvent> {
  let usage: TokenUsage | undefined
  const calls = new Map<string, { name: string; input: unknown }>()
  try {
    for await (const raw of port(request)) {
      const event = raw as Event & ToolEvent
      if (event.type === 'TEXT_MESSAGE_CONTENT' && event.delta) {
        yield { type: 'delta', text: event.delta }
      } else if (event.type === 'TOOL_CALL_END' && event.toolCallId) {
        calls.set(event.toolCallId, {
          name: event.metadata?.tanstack?.toolCallName ?? '',
          input: event.input
        })
      } else if (
        event.type === 'TOOL_CALL_RESULT' &&
        event.metadata?.tanstack?.state === 'output-error'
      ) {
        yield {
          type: 'tool-rejected',
          toolName: calls.get(event.toolCallId ?? '')?.name ?? '',
          message: toolErrorMessage(event.content)
        }
      } else if (event.type === 'RUN_FINISHED' && event.outcome?.type === 'interrupt') {
        usage = readUsage(event.usage) ?? usage
        for (const interrupt of event.outcome.interrupts ?? []) {
          const call = calls.get(interrupt.toolCallId ?? '')
          if (call) yield { type: 'approval-requested', toolName: call.name, input: call.input }
        }
      } else if (event.type === 'RUN_ERROR') {
        if (request.signal.aborted) return
        yield { type: 'error', failure: runErrorFailure(event) }
        return
      } else if (event.type === 'RUN_FINISHED') {
        usage = readUsage(event.usage) ?? usage
      }
    }
  } catch (error) {
    if (request.signal.aborted) return
    yield {
      type: 'error',
      failure: {
        kind: 'provider-error',
        message: error instanceof Error ? error.message : 'The model request failed'
      }
    }
    return
  }
  if (!request.signal.aborted) yield { type: 'done', usage }
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
      ...(request.outputSchema && { outputSchema: request.outputSchema }),
      ...(request.tools?.length && {
        tools: request.tools.map((t) =>
          toolDefinition({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema ?? z.object({}),
            ...(t.needsApproval && { needsApproval: true })
          }).server(async (input) => t.execute(input))
        )
      }),
      // The cap goes through the adapter's model options, not the top-level option.
      modelOptions: { max_tokens: request.maxTokens },
      stream: true,
      abortController
    }) as AsyncIterable<unknown>
  }
}
