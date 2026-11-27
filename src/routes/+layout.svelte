<script lang="ts">
  import './layout.css'
  import favicon from '#lib/assets/favicon.svg'
  import { dev } from '$app/env'
  import { QueryClientProvider } from '@tanstack/svelte-query'
  import { createQueryClient } from '#lib/query/client.ts'
  import { connectLiveUpdates } from '#lib/live/client.ts'
  import type { LayoutProps } from './$types'

  import AppHeader from '#lib/ui/AppHeader.svelte'
  import { page } from '$app/state'

  let { children, data }: LayoutProps = $props()

  const queryClient = createQueryClient()

  // Server state changes (a DM attaching, say) reach every page through one SSE stream.
  $effect(() => connectLiveUpdates(queryClient))
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<AppHeader
  lan={data.lan}
  isHost={data.isHost}
  joinUrls={data.joinUrls}
  theme={data.theme}
  redirectTo={page.url.pathname + page.url.search}
/>

<QueryClientProvider client={queryClient}>
  {@render children()}

  {#if dev && data.isHost}
    {#await import('#lib/dev/ReportIssue.svelte') then { default: ReportIssue }}
      <ReportIssue url={page.url.href} route={page.route.id} params={page.params} />
    {/await}
    {#await import('@tanstack/svelte-query-devtools') then { SvelteQueryDevtools }}
      <SvelteQueryDevtools />
    {/await}
  {/if}
</QueryClientProvider>
