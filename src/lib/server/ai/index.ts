import { LM_STUDIO_BASE_URL, LM_STUDIO_CONTEXT_LIMIT, LM_STUDIO_MODEL } from '$app/env/private'
import { createChatAdapter } from './adapter.ts'
import { resolveAiConfig, withContextFallback } from './config.ts'
import { createReasoningLock } from './lock.ts'
import { probeAi } from './probe.ts'
import { createChatPort } from './port.ts'
import type { AiStatus } from '#lib/ai/status.ts'

/** Server-only: never import this from browser code. */
const config = resolveAiConfig({
  baseUrl: LM_STUDIO_BASE_URL,
  model: LM_STUDIO_MODEL,
  contextLimit: LM_STUDIO_CONTEXT_LIMIT
})

export type { AiStatus }

const reasoningLock = createReasoningLock(() => probeAi(config))

/**
 * Probes LM Studio now (unless a reasoning model locked the AI, see `lockReasoningModel`).
 * `recheck` is an explicit user re-probe, the only thing that can release the lock.
 * The result never contains the base URL.
 */
export async function getAiStatus(options?: { recheck?: boolean }): Promise<AiStatus> {
  return withContextFallback(await reasoningLock.status(options), config.contextLimit)
}

/** Disables the AI until a successful re-probe or a server restart. */
export function lockReasoningModel() {
  if (config.model) reasoningLock.engage(config.model)
}

export function isReasoningModelLocked() {
  return reasoningLock.locked
}

/** The configured chat port for per-field generation, or null when no model is set. */
export function getChatPort() {
  const adapter = getChatAdapter()
  return adapter ? createChatPort(adapter) : null
}

/** The configured chat adapter, or null when no model is set. */
export function getChatAdapter() {
  return config.model ? createChatAdapter({ baseUrl: config.baseUrl, model: config.model }) : null
}
