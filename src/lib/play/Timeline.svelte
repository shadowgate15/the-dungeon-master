<script lang="ts">
  import type { Snippet } from 'svelte'

  /**
   * The console's centre: the Show filters above one timeline, DM on the left and the Player on
   * the right. Narration, rolls and DM activity join it in later slices; until then it says the
   * story has not started.
   */
  let { children }: { children?: Snippet } = $props()

  let show = $state({ story: true, rolls: true, dm: true })
  const filters = [
    ['story', 'Story'],
    ['rolls', 'Rolls'],
    ['dm', 'DM activity']
  ] as const
</script>

<div role="group" aria-label="Show" class="flex items-center gap-3 text-xs">
  <span class="text-muted">Show</span>
  {#each filters as [key, label] (key)}
    <label class="flex items-center gap-1">
      <input type="checkbox" bind:checked={show[key]} class="rounded" />
      {label}
    </label>
  {/each}
</div>
<ol
  aria-label="Timeline"
  class="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto rounded-panel border border-border bg-surface p-3"
>
  {#if children}
    {@render children()}
  {:else}
    <li class="m-auto text-sm text-muted">Nothing has happened yet.</li>
  {/if}
</ol>
