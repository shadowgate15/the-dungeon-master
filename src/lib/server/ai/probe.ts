import type { AiStatus } from '#lib/ai/status.ts'

export interface ProbeOptions {
  baseUrl: string
  /** null when the operator has not set a model. */
  model: string | null
  fetch?: typeof fetch
  timeoutMs?: number
}

const DEFAULT_TIMEOUT_MS = 3000

/** Rejects (and aborts the request) if `fetch` has not answered within `timeoutMs`. */
async function getJson(doFetch: typeof fetch, url: string, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort()
      reject(new Error('timeout'))
    }, timeoutMs)
  })
  try {
    const response = await Promise.race([doFetch(url, { signal: controller.signal }), timeout])
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await Promise.race([response.json(), timeout])
  } finally {
    clearTimeout(timer)
  }
}

function modelIds(payload: unknown): string[] {
  const data = (payload as { data?: { id?: unknown }[] } | null)?.data
  return Array.isArray(data) ? data.flatMap((m) => (typeof m.id === 'string' ? [m.id] : [])) : []
}

/**
 * LM Studio's own listing reports the context length the model is loaded with.
 * It is best effort: other OpenAI-compatible servers do not have it.
 */
async function loadedContextLength(
  doFetch: typeof fetch,
  baseUrl: string,
  model: string,
  timeoutMs: number
): Promise<number | null> {
  try {
    const payload = await getJson(doFetch, `${new URL(baseUrl).origin}/api/v0/models`, timeoutMs)
    const data = (payload as { data?: Record<string, unknown>[] } | null)?.data ?? []
    const length = data.find((m) => m.id === model)?.loaded_context_length
    return typeof length === 'number' ? length : null
  } catch {
    return null
  }
}

export async function probeAi({
  baseUrl,
  model,
  fetch: doFetch = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS
}: ProbeOptions): Promise<AiStatus> {
  if (!model) return { state: 'not-configured' }

  let installed: string[]
  try {
    installed = modelIds(await getJson(doFetch, `${baseUrl.replace(/\/+$/, '')}/models`, timeoutMs))
  } catch {
    return { state: 'unreachable', model }
  }

  if (!installed.includes(model)) return { state: 'model-unavailable', model }

  return {
    state: 'ready',
    model,
    contextLength: await loadedContextLength(doFetch, baseUrl, model, timeoutMs)
  }
}
