<script module lang="ts">
  export type ActionNotice = {
    message: string
    /** The reverse action, offered as Undo; absent when the action cannot be reversed. */
    undo?: { action: 'archive' | 'restore'; ids: string[] }
  }
</script>

<script lang="ts">
  import { enhance } from '$app/forms'
  import Button from '#lib/ui/Button.svelte'
  import Toast from '#lib/ui/Toast.svelte'

  let {
    notice,
    view = 'active'
  }: { notice: ActionNotice | undefined; view?: 'active' | 'archived' } = $props()

  // Dismissal is per notice object, so the next action's notice shows again.
  let dismissed = $state.raw<ActionNotice | undefined>()
</script>

{#if notice && notice !== dismissed}
  <Toast onclose={() => (dismissed = notice)}>
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
        <Button type="submit" variant="secondary" size="sm">Undo</Button>
      </form>
    {/if}
  </Toast>
{/if}
