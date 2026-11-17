<!-- PROTOTYPE (throwaway): backend, input and cap toggles plus reset. -->
<script lang="ts">
  import type { SceneStore } from './store.svelte.ts'

  let { store }: { store: SceneStore } = $props()
</script>

<div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
  <label class="flex items-center gap-1">
    <input type="checkbox" bind:checked={store.fake} disabled={!store.aiConfigured || store.busy} />
    Fake backend
  </label>
  {#if !store.aiConfigured}
    <span class="text-warning">No model configured (set LM_STUDIO_MODEL): fake only</span>
  {/if}
  <label class="flex items-center gap-1">
    <input type="checkbox" bind:checked={store.affordances} />
    Affordances
  </label>
  <label class="flex items-center gap-1">
    Step cap
    <input
      type="number"
      min="1"
      max="12"
      class="w-14 rounded-control border border-control-border bg-raised px-1 py-0"
      bind:value={store.stepCap}
    />
  </label>
  <button
    type="button"
    class="rounded-control border border-border px-2 py-0.5 hover:bg-surface disabled:opacity-50"
    disabled={store.busy}
    onclick={() => store.reset()}>Reset scenario</button
  >
</div>
{#if store.error}
  <p class="mt-1 rounded-control bg-danger-bg px-2 py-1 text-xs text-danger">{store.error}</p>
{/if}
