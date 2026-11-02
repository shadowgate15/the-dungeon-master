import type { AiStatus } from '#lib/ai/status.ts'
import { DEFAULT_CONTEXT_LIMIT } from '#lib/world/context.ts'

export const DEFAULT_LM_STUDIO_BASE_URL = 'http://localhost:1234/v1'

export interface AiConfig {
  baseUrl: string
  /** null means the operator has not configured a model. */
  model: string | null
  /** Context limit used when the loaded model's own length is unknown. */
  contextLimit: number
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
    contextLimit: Number.isInteger(limit) && limit > 0 ? limit : DEFAULT_CONTEXT_LIMIT
  }
}

/** Tells the browser which limit to use when the probe could not read the loaded length. */
export function withContextFallback(status: AiStatus, contextLimit: number): AiStatus {
  return status.state === 'ready' ? { ...status, fallbackContextLength: contextLimit } : status
}
