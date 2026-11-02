<script lang="ts">
  // PROTOTYPE: throwaway. Undo toast shared by the variants.
  import type { Toast } from './store.svelte.ts'

  let { toast, ondismiss }: { toast: Toast | null; ondismiss: () => void } = $props()
</script>

{#if toast}
  <div
    role="status"
    class="fixed right-4 bottom-20 z-40 flex items-center gap-3 rounded bg-slate-900 px-4 py-2 text-sm text-white shadow-lg"
  >
    <span>{toast.message}</span>
    {#if toast.undo}
      <button
        type="button"
        class="font-semibold text-amber-300 underline"
        onclick={() => {
          toast.undo?.()
          ondismiss()
        }}>Undo</button
      >
    {/if}
    <button type="button" aria-label="Dismiss" class="text-slate-400" onclick={ondismiss}>✕</button>
  </div>
{/if}
