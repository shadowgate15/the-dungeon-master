import { LM_STUDIO_BASE_URL, LM_STUDIO_MODEL } from '$app/env/private'
import { createChatAdapter } from './adapter.ts'
import { resolveAiConfig } from './config.ts'
import { probeAi } from './probe.ts'
import { createChatPort } from './world-conversation.ts'
import type { AiStatus } from '#lib/ai/status.ts'

/** Server-only: never import this from browser code. */
const config = resolveAiConfig({ baseUrl: LM_STUDIO_BASE_URL, model: LM_STUDIO_MODEL })

export type { AiStatus }

/** Probes LM Studio now. The result never contains the base URL. */
export function getAiStatus(): Promise<AiStatus> {
  return probeAi(config)
}

/** The configured chat port for conversation modules, or null when no model is set. */
export function getChatPort() {
  const adapter = getChatAdapter()
  return adapter ? createChatPort(adapter) : null
}

/** The configured chat adapter, or null when no model is set. */
export function getChatAdapter() {
  return config.model ? createChatAdapter({ baseUrl: config.baseUrl, model: config.model }) : null
}
