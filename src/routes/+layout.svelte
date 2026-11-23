<script lang="ts">
  import './layout.css'
  import favicon from '#lib/assets/favicon.svg'
  import { dev } from '$app/env'
  import { QueryClientProvider } from '@tanstack/svelte-query'
  import { createQueryClient } from '#lib/query/client.ts'
  import { connectLiveUpdates } from '#lib/live/client.ts'
  import type { LayoutProps } from './$types'

  import ThemeToggle from '#lib/theme/ThemeToggle.svelte'
  import { page } from '$app/state'
  import { resolve } from '$app/paths'

  let { children, data }: LayoutProps = $props()

  const queryClient = createQueryClient()

  // Server state changes (a DM attaching, say) reach every page through one SSE stream.
  $effect(() => connectLiveUpdates(queryClient))
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<header class="flex h-12 items-center justify-end gap-4 border-b border-border px-4">
  <a href={resolve('/credits')} class="text-sm underline">Credits</a>
  <ThemeToggle theme={data.theme} redirectTo={page.url.pathname + page.url.search} />
</header>

<QueryClientProvider client={queryClient}>
  {@render children()}

  {#if dev}
    {#await import('#lib/dev/ReportIssue.svelte') then { default: ReportIssue }}
      <ReportIssue url={page.url.href} route={page.route.id} params={page.params} />
    {/await}
    {#await import('@tanstack/svelte-query-devtools') then { SvelteQueryDevtools }}
      <SvelteQueryDevtools />
    {/await}
  {/if}
</QueryClientProvider>
