export const DEFAULT_LM_STUDIO_BASE_URL = 'http://localhost:1234/v1'

export interface AiConfig {
  baseUrl: string
  /** null means the operator has not configured a model. */
  model: string | null
}

/** Normalizes the raw server env values: blanks count as unset. */
export function resolveAiConfig(raw: { baseUrl?: string; model?: string }): AiConfig {
  return {
    baseUrl: raw.baseUrl?.trim() || DEFAULT_LM_STUDIO_BASE_URL,
    model: raw.model?.trim() || null
  }
}
