import { chat } from '@tanstack/ai'
import { z } from 'zod'
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
 * Extension points: #31 changes how the client applies `proposals` (this module stays
 * as is); #32 adds `signal`/retry around the port call in `runTurn` and new failure
 * kinds to `TurnFailure`; #33 adds `usage` to the success result and a compaction
 * step that rewrites `history` before `buildRequest`.
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
  message: string
}

/** What the port receives; independent of any provider. */
export interface ChatRequest {
  systemPrompts: string[]
  messages: ChatMessage[]
  maxTokens: number
  threadId: string
  outputSchema: typeof turnSchema
}

/** Streams provider-neutral AG-UI style events for one request. */
export type ChatPort = (request: ChatRequest) => AsyncIterable<unknown>

export type TurnFailure =
  { kind: 'provider-error'; message: string } | { kind: 'invalid-output'; message: string }

export type TurnResult =
  | { ok: true; reply: string; proposals: Partial<Record<SeedField, string>> }
  | { ok: false; failure: TurnFailure }

const SYSTEM_PROMPT = `You are helping a player create a fantasy World for a tabletop role-playing campaign.
Reply with a short message (a sentence or two) and a "proposals" object holding only the seed fields you want to change.
Seed fields: name (short text), premise (a few sentences), genreFlavor, scale, magicLevel, techLevel (each one of the allowed values).
Leave out fields you do not want to change. Never repeat a proposal the user dismissed. Respect values the user already set unless asked to change them.`

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

export function buildRequest(input: TurnInput): ChatRequest {
  const systemPrompts = [SYSTEM_PROMPT, seedPrompt(input.seed)]
  const dismissed = dismissedPrompt(input.dismissed)
  if (dismissed) systemPrompts.push(dismissed)
  return {
    systemPrompts,
    messages: [...input.history, { role: 'user', content: input.message }],
    maxTokens: MAX_TOKENS,
    // chat() requires a non-empty threadId; nothing is persisted, so each turn is its own.
    threadId: crypto.randomUUID(),
    outputSchema: turnSchema
  }
}

type Event = { type?: string; name?: string; message?: string; value?: { object?: unknown } }

export async function runTurn(port: ChatPort, input: TurnInput): Promise<TurnResult> {
  let object: unknown
  try {
    for await (const raw of port(buildRequest(input))) {
      const event = raw as Event
      if (event.type === 'RUN_ERROR') {
        return {
          ok: false,
          failure: { kind: 'provider-error', message: event.message ?? 'The model request failed' }
        }
      }
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
  return { ok: true, reply: parsed.data.reply, proposals }
}

/** The production port: TanStack AI `chat()` over the configured adapter. */
export function createChatPort(adapter: ReturnType<typeof createChatAdapter>): ChatPort {
  return (request) =>
    chat({
      adapter,
      systemPrompts: request.systemPrompts,
      messages: request.messages,
      threadId: request.threadId,
      outputSchema: request.outputSchema,
      // The cap goes through the adapter's model options, not the top-level option.
      modelOptions: { max_tokens: request.maxTokens },
      stream: true
    }) as AsyncIterable<unknown>
}
