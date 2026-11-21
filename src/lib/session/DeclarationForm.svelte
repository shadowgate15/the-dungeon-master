<script lang="ts">
  import Button from '#lib/ui/Button.svelte'
  import Textarea from '#lib/ui/Textarea.svelte'

  let {
    draft = $bindable(''),
    busy,
    callOpen,
    question = false,
    onsend,
    onanswer,
    onstop
  }: {
    draft?: string
    /** An Exchange is running: the input waits and Stop replaces Send. */
    busy: boolean
    /** A Call is open. Typing stays allowed: sending withdraws the Call. */
    callOpen: boolean
    /**
     * The open Call is a clarifying question. What is typed answers it ("Answer", the primary
     * button); "Do something else" sends it as a new Declaration instead, withdrawing the question.
     */
    question?: boolean
    /** Sends the trimmed Declaration. */
    onsend: (text: string) => void
    /** Answers the open question with the trimmed text. */
    onanswer?: (text: string) => void
    onstop: () => void
  } = $props()

  const answering = $derived(question && onanswer !== undefined)

  function submit(e: SubmitEvent) {
    e.preventDefault()
    const text = draft.trim()
    if (!text || busy) return
    const declare = (e.submitter as HTMLButtonElement | null)?.value === 'declare'
    if (answering && !declare) onanswer?.(text)
    else onsend(text)
  }

  const placeholder = $derived(
    answering
      ? 'Answer, or do something else.'
      : callOpen
        ? 'Roll, or do something else.'
        : 'What do you do?'
  )
</script>

<form onsubmit={submit} class="flex items-end gap-2">
  <label class="flex-1 text-sm">
    Your action
    <Textarea bind:value={draft} rows={2} disabled={busy} {placeholder} />
  </label>
  {#if busy}
    <Button type="button" variant="secondary" onclick={onstop}>Stop</Button>
  {:else if answering}
    <div class="flex flex-col gap-1">
      <Button type="submit" disabled={!draft.trim()}>Answer</Button>
      <Button type="submit" variant="secondary" value="declare" disabled={!draft.trim()}
        >Do something else</Button
      >
    </div>
  {:else}
    <Button type="submit" disabled={!draft.trim()}>Send</Button>
  {/if}
</form>
