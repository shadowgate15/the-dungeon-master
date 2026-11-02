<script lang="ts">
  import type { Snippet } from 'svelte'
  import { createQuery, useQueryClient } from '@tanstack/svelte-query'
  import AiStatusView from './AiStatusView.svelte'
  import type { AiStatus } from './status.ts'

  type Props = {
    chat?: Snippet<
      [
        Extract<AiStatus, { state: 'ready' | 'reasoning-model' }>,
        { reasoningModel: () => void; unavailable: (status: AiStatus) => void }
      ]
    >
  }

  let { chat }: Props = $props()

  const queryClient = useQueryClient()
  // Set by "Check connection" so the server knows to re-probe and may release a lock.
  let recheck = false

  // Probed on mount and on "Check connection" only: no polling, no refetch on focus.
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

  // The server locked the AI after a turn showed a reasoning model: reflect it without
  // probing, so the lock holds until the user explicitly checks the connection.
  function reasoningModel() {
    const current = queryClient.getQueryData<AiStatus>(['ai-status'])
    if (current && 'model' in current) {
      const locked: AiStatus = { state: 'reasoning-model', model: current.model }
      queryClient.setQueryData(['ai-status'], locked)
    }
  }

  // A send's pre-probe found LM Studio down or the model missing: show that state.
  function unavailable(status: AiStatus) {
    queryClient.setQueryData(['ai-status'], status)
  }
</script>

<AiStatusView
  status={query.data}
  checking={query.isFetching}
  oncheck={() => {
    recheck = true
    return query.refetch()
  }}
  chat={chat ? chatWithActions : undefined}
/>

{#snippet chatWithActions(status: Extract<AiStatus, { state: 'ready' | 'reasoning-model' }>)}
  {@render chat?.(status, { reasoningModel, unavailable })}
{/snippet}
