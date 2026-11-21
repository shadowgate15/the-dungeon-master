<script lang="ts">
  import Button from '#lib/ui/Button.svelte'
  import Textarea from '#lib/ui/Textarea.svelte'

  let {
    draft = $bindable(''),
    busy,
    callOpen,
    onsend,
    onstop
  }: {
    draft?: string
    /** An Exchange is running: the input waits and Stop replaces Send. */
    busy: boolean
    /** A Call is open. Typing stays allowed: sending withdraws the Call. */
    callOpen: boolean
    /** Sends the trimmed Declaration. */
    onsend: (text: string) => void
    onstop: () => void
  } = $props()

  function submit(e: SubmitEvent) {
    e.preventDefault()
    const text = draft.trim()
    if (text && !busy) onsend(text)
  }
</script>

<form onsubmit={submit} class="flex items-end gap-2">
  <label class="flex-1 text-sm">
    Your action
    <Textarea
      bind:value={draft}
      rows={2}
      disabled={busy}
      placeholder={callOpen ? 'Roll, or do something else.' : 'What do you do?'}
    />
  </label>
  {#if busy}
    <Button type="button" variant="secondary" onclick={onstop}>Stop</Button>
  {:else}
    <Button type="submit" disabled={!draft.trim()}>Send</Button>
  {/if}
</form>
