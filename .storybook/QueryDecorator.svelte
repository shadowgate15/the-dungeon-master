<script lang="ts">
  import type { Snippet } from 'svelte'
  import { QueryClientProvider } from '@tanstack/svelte-query'
  import { createQueryClient } from '../src/lib/query/client'

  let { children }: { children: Snippet } = $props()

  const queryClient = createQueryClient({ queries: { retry: false } })
</script>

<QueryClientProvider client={queryClient}>
  {@render children()}
</QueryClientProvider>
