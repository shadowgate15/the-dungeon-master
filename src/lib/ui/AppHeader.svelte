<script lang="ts">
  import type { ComponentProps } from 'svelte'
  import { resolve } from '$app/paths'
  import LanStatus from '#lib/lan/LanStatus.svelte'
  import StopServer from '#lib/server-control/StopServer.svelte'
  import ThemeToggle from '#lib/theme/ThemeToggle.svelte'

  let {
    lan,
    isHost,
    joinUrls,
    theme,
    redirectTo
  }: {
    lan: boolean
    isHost: boolean
    joinUrls: string[]
    theme: ComponentProps<typeof ThemeToggle>['theme']
    redirectTo: string
  } = $props()
</script>

<header class="flex h-12 items-center justify-end gap-4 border-b border-border px-4">
  <LanStatus {lan} {isHost} {joinUrls} />
  <!-- Stopping the server is the Host's act; a remote browser never sees it. -->
  {#if isHost}<StopServer />{/if}
  <a href={resolve('/credits')} class="text-sm underline">Credits</a>
  <ThemeToggle {theme} {redirectTo} />
</header>
