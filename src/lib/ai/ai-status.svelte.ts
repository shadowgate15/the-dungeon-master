import { createQuery, useQueryClient } from '@tanstack/svelte-query'
import { REASONING_MODEL_MESSAGE, type AiStatus } from './status.ts'

/**
 * The shared AI availability: one query for the whole page, probed on mount and on "Check
 * connection" only (no polling, no refetch on focus). Call it once per page during component
 * init and hand the result to `AiPanel` (the status view with Check connection) and to
 * `createFieldAi` (the per-field controls), so they always agree.
 */
export function createAiStatus() {
  const queryClient = useQueryClient()
  // Set by "Check connection" so the server knows to re-probe and may release a lock.
  let recheck = false

  const query = createQuery(() => ({
    queryKey: ['ai-status'],
    queryFn: async (): Promise<AiStatus> => {
      const url = recheck ? '/api/ai/status?recheck=1' : '/api/ai/status'
      recheck = false
      const response = await fetch(url)
      if (!response.ok) throw new Error(`Status check failed (${response.status})`)
      return response.json()
    },
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: Infinity
  }))

  return {
    /** undefined until the first probe answers. */
    get status(): AiStatus | undefined {
      return query.data
    },
    get checking() {
      return query.isFetching
    },
    /** Re-probes, and lets the server release a reasoning-model lock. */
    check() {
      recheck = true
      return query.refetch()
    },
    /** A call showed a reasoning model: lock the UI without probing. */
    reasoningModel() {
      const current = queryClient.getQueryData<AiStatus>(['ai-status'])
      if (current && 'model' in current) {
        const locked: AiStatus = { state: 'reasoning-model', model: current.model }
        queryClient.setQueryData(['ai-status'], locked)
      }
    },
    /** A call's pre-probe found LM Studio down or the model missing: show that state. */
    unavailable(status: AiStatus) {
      queryClient.setQueryData(['ai-status'], status)
    }
  }
}

export type AiStatusStore = ReturnType<typeof createAiStatus>

/** Why the field buttons are disabled for a status, or undefined when AI is ready. */
export function unavailableReason(status: AiStatus | undefined): string | undefined {
  switch (status?.state) {
    case undefined:
      return 'Checking the AI connection…'
    case 'ready':
      return undefined
    case 'not-configured':
      return 'AI is not configured'
    case 'unreachable':
      return 'Not connected. Start LM Studio, or check the server configuration.'
    case 'model-unavailable':
      return `The model ${status.model} is not available in LM Studio.`
    case 'reasoning-model':
      return REASONING_MODEL_MESSAGE
  }
}
