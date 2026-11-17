<!-- PROTOTYPE (throwaway): the roll overlay, shown over any mode while a roll is pending. -->
<script lang="ts">
  import type { SceneStore } from './store.svelte.ts'

  let { store }: { store: SceneStore } = $props()
</script>

{#if store.state.pendingRoll && !store.busy}
  <div class="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
    <div class="w-full max-w-sm space-y-3 rounded-panel bg-raised p-6 text-center shadow-overlay">
      <p class="font-display text-xl capitalize">{store.state.pendingRoll.check} check</p>
      <p class="text-sm text-muted">{store.state.pendingRoll.reason}</p>
      <p class="text-3xl font-semibold">DC {store.state.pendingRoll.dc}</p>
      <button
        type="button"
        class="w-full rounded-control bg-primary px-4 py-2 text-on-primary"
        onclick={() => store.roll()}>Roll d20</button
      >
    </div>
  </div>
{/if}
