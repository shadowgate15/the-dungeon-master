<script module lang="ts">
  export type ActionNotice = {
    message: string
    /** The reverse action, offered as Undo; absent when the action cannot be reversed. */
    undo?: { action: 'archive' | 'restore'; ids: string[] }
  }
</script>

<script lang="ts">
  import { enhance } from '$app/forms'

  let {
    notice,
    view = 'active'
  }: { notice: ActionNotice | undefined; view?: 'active' | 'archived' } = $props()

  // Dismissal is per notice object, so the next action's notice shows again.
  let dismissed = $state.raw<ActionNotice | undefined>()
</script>

{#if notice && notice !== dismissed}
  <div
    role="status"
    class="fixed right-4 bottom-4 z-40 flex items-center gap-3 rounded bg-slate-900 px-4 py-2 text-sm text-white shadow-lg"
  >
    <span>{notice.message}</span>
    {#if notice.undo}
      <form
        method="POST"
        action="?/{notice.undo.action}{view === 'archived' ? '&view=archived' : ''}"
        use:enhance
      >
        {#each notice.undo.ids as id (id)}
          <input type="hidden" name="id" value={id} />
        {/each}
        <button type="submit" class="font-semibold text-amber-300 underline">Undo</button>
      </form>
    {/if}
    <button
      type="button"
      aria-label="Dismiss"
      class="text-slate-400"
      onclick={() => (dismissed = notice)}>✕</button
    >
  </div>
{/if}
