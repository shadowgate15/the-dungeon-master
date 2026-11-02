<script lang="ts">
  import type { Snippet } from 'svelte'
  import { createQuery } from '@tanstack/svelte-query'
  import AiStatusView from './AiStatusView.svelte'
  import type { AiStatus } from './status.ts'

  type Props = { chat?: Snippet<[Extract<AiStatus, { state: 'ready' }>]> }

  let { chat }: Props = $props()

  // Probed on mount and on "Check connection" only: no polling, no refetch on focus.
  const query = createQuery(() => ({
    queryKey: ['ai-status'],
    queryFn: async (): Promise<AiStatus> => {
      const response = await fetch('/api/ai/status')
      if (!response.ok) throw new Error(`Status check failed (${response.status})`)
      return response.json()
    },
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: Infinity
  }))
</script>

<AiStatusView
  status={query.data}
  checking={query.isFetching}
  oncheck={() => query.refetch()}
  {chat}
/>
