<script lang="ts">
  import './layout.css'
  import favicon from '#lib/assets/favicon.svg'
  import { dev } from '$app/env'
  import { QueryClientProvider } from '@tanstack/svelte-query'
  import { createQueryClient } from '#lib/query/client.ts'
  import type { LayoutProps } from './$types'

  let { children }: LayoutProps = $props()

  const queryClient = createQueryClient()
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<QueryClientProvider client={queryClient}>
  {@render children()}

  {#if dev}
    {#await import('@tanstack/svelte-query-devtools') then { SvelteQueryDevtools }}
      <SvelteQueryDevtools />
    {/await}
  {/if}
</QueryClientProvider>
