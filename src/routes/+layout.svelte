<script lang="ts">
  import './layout.css'
  import favicon from '#lib/assets/favicon.svg'
  import { dev } from '$app/env'
  import { QueryClientProvider } from '@tanstack/svelte-query'
  import { createQueryClient } from '#lib/query/client.ts'
  import type { LayoutProps } from './$types'

  import ThemeToggle from '#lib/theme/ThemeToggle.svelte'
  import { page } from '$app/state'

  let { children, data }: LayoutProps = $props()

  const queryClient = createQueryClient()
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<header class="flex items-center justify-end border-b border-border px-4 py-2">
  <ThemeToggle theme={data.theme} redirectTo={page.url.pathname + page.url.search} />
</header>

<QueryClientProvider client={queryClient}>
  {@render children()}

  {#if dev}
    {#await import('@tanstack/svelte-query-devtools') then { SvelteQueryDevtools }}
      <SvelteQueryDevtools />
    {/await}
  {/if}
</QueryClientProvider>
