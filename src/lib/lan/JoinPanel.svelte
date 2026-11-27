<script lang="ts">
  import { renderSVG } from 'uqr'
  import Panel from '#lib/ui/Panel.svelte'

  let { joinUrls }: { joinUrls: string[] } = $props()
</script>

<Panel title="Join" level={3}>
  {#if joinUrls.length === 0}
    <p class="text-sm">No network address found. Check that this machine is on a network.</p>
  {:else}
    <p class="text-sm">Open one of these on a device on the same network, or scan its code.</p>
    <ul class="space-y-3">
      {#each joinUrls as url (url)}
        <li class="space-y-1">
          <code class="text-sm break-all">{url}</code>
          <div role="img" aria-label={`QR code for ${url}`} class="size-40 bg-white p-2">
            <!-- eslint-disable-next-line svelte/no-at-html-tags -- uqr output from our own URL -->
            {@html renderSVG(url, { border: 0 })}
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</Panel>
