import type { AiStatus } from '#lib/ai/status.ts'

/** Used when the model's context length is unknown and nothing is configured. */
export const DEFAULT_CONTEXT_LIMIT = 4096

export const DEFAULT_LM_STUDIO_BASE_URL = 'http://localhost:1234/v1'

/** The model the docs and the example env name: the one the Exchange contract passed the eval on. */
export const DEFAULT_MODEL = 'qwen/qwen3.5-9b'

/** Sampling settings sent with every chat request. */
export interface ModelSampling {
  temperature: number
  /** Sent as `reasoning_effort`; absent leaves the model's own default. */
  reasoningEffort?: 'none' | 'low' | 'medium' | 'high'
}

/**
 * Temperature 0.7, since LM Studio's preset is 1.0 when none is sent. Reasoning off: with it on,
 * a structured answer lands in the reasoning field, and an Exchange takes minutes (see
 * docs/research/exchange-model-eval.md).
 */
export const DEFAULT_SAMPLING: ModelSampling = { temperature: 0.7, reasoningEffort: 'none' }

export interface AiConfig {
  baseUrl: string
  /** null means the operator has not configured a model. */
  model: string | null
  /** Context limit used when the loaded model's own length is unknown. */
  contextLimit: number
  /** Sent with every request; one model and one setting serve every step. */
  sampling: ModelSampling
}

/** Normalizes the raw server env values: blanks count as unset. */
export function resolveAiConfig(raw: {
  baseUrl?: string
  model?: string
  contextLimit?: string
}): AiConfig {
  const limit = Number(raw.contextLimit?.trim())
  return {
    baseUrl: raw.baseUrl?.trim() || DEFAULT_LM_STUDIO_BASE_URL,
    model: raw.model?.trim() || null,
    contextLimit: Number.isInteger(limit) && limit > 0 ? limit : DEFAULT_CONTEXT_LIMIT,
    sampling: DEFAULT_SAMPLING
  }
}

/** Tells the browser which limit to use when the probe could not read the loaded length. */
export function withContextFallback(status: AiStatus, contextLimit: number): AiStatus {
  return status.state === 'ready' ? { ...status, fallbackContextLength: contextLimit } : status
}
