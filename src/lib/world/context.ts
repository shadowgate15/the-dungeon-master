/**
 * Client-safe context accounting for Creation conversations (World, Campaign): the meter, the
 * character-estimate fallback and the compaction thresholds. Pure; no model access.
 */

/** Warn, and compact before the next send, at this share of the context limit. */
export const COMPACT_THRESHOLD = 0.8

/** How many of the newest messages (three exchanges) always stay verbatim. */
export const KEEP_MESSAGES = 6

/** Used when the model's context length is unknown and nothing is configured. */
export const DEFAULT_CONTEXT_LIMIT = 4096

const CHARS_PER_TOKEN = 3
/** The system prompt and the output schema, which every request carries. */
const FIXED_OVERHEAD_TOKENS = 400
/** Mirrors the dismissed-note bounds in the prompt builder. */
const DISMISSED_VALUE_CHARS = 100

export function estimateTokens(text: string) {
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

export interface PromptParts {
  seed: Record<string, string>
  /** The full visible history (via `historyOf`), including summarized messages. */
  history: { role: 'user' | 'assistant'; content: string }[]
  /** The model-facing summary of the first `summarizedCount` history messages. */
  summary?: string | null
  summarizedCount?: number
  dismissed: { field: string; value: string }[]
  pending?: { field: string; value: string }[]
  message?: string
}

/** Character-based estimate of what the next request will weigh, in tokens. */
export function estimatePromptTokens(parts: PromptParts) {
  const live = parts.history.slice(parts.summarizedCount ?? 0)
  const chars =
    Object.values(parts.seed).reduce((n, v) => n + v.length, 0) +
    (parts.summary?.length ?? 0) +
    live.reduce((n, m) => n + m.content.length, 0) +
    parts.dismissed.reduce((n, d) => n + d.value.slice(0, DISMISSED_VALUE_CHARS).length, 0) +
    (parts.pending ?? []).reduce((n, p) => n + p.value.length, 0) +
    (parts.message?.length ?? 0)
  return FIXED_OVERHEAD_TOKENS + Math.ceil(chars / CHARS_PER_TOKEN)
}

export function contextMeter({ used, limit }: { used: number; limit: number }) {
  return {
    used,
    limit,
    percent: Math.min(100, Math.round((used / limit) * 100)),
    warn: used >= limit * COMPACT_THRESHOLD
  }
}

export function shouldCompact({ projected, limit }: { projected: number; limit: number }) {
  return projected >= limit * COMPACT_THRESHOLD
}

export function exceedsLimit({ projected, limit }: { projected: number; limit: number }) {
  return projected > limit
}
