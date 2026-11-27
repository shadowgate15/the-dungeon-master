<script lang="ts">
  import Badge from '#lib/ui/Badge.svelte'
  import JoinPanel from './JoinPanel.svelte'

  let { lan, isHost, joinUrls }: { lan: boolean; isHost: boolean; joinUrls: string[] } = $props()
</script>

{#if lan && isHost}
  <details class="relative">
    <summary class="cursor-pointer list-none">
      <Badge variant="info">Open on LAN</Badge>
    </summary>
    <div class="absolute right-0 z-10 mt-2 w-80">
      <JoinPanel {joinUrls} />
    </div>
  </details>
{/if}
