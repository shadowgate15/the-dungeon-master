<script lang="ts">
  import Button from '#lib/ui/Button.svelte'
  import Textarea from '#lib/ui/Textarea.svelte'
  import type { PendingDeclaration } from './floor'

  /**
   * The pinned composer: the open Floor's pending tray above a box that adds a Declaration for the
   * acting Character. Every tray entry can be edited or withdrawn until the Floor closes. A pure
   * view; the console wires the callbacks to the server.
   */
  let {
    acting,
    declarations,
    onsend,
    onedit,
    onwithdraw,
    disabled = false
  }: {
    /** The acting Character's name, or null when no Character can act. */
    acting: string | null
    declarations: PendingDeclaration[]
    onsend: (text: string) => void
    onedit: (id: string, text: string) => void
    onwithdraw: (id: string) => void
    disabled?: boolean
  } = $props()

  let draft = $state('')
  let editing = $state<{ id: string; text: string } | null>(null)

  const blocked = $derived(disabled || acting === null)
  const label = (d: PendingDeclaration) => `${d.characterName}: ${d.text}`

  function send() {
    const text = draft.trim()
    if (!text || blocked) return
    onsend(text)
    draft = ''
  }

  function save() {
    if (!editing) return
    const text = editing.text.trim()
    if (text) onedit(editing.id, text)
    editing = null
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault()
      send()
    }
  }
</script>

<div class="flex flex-col gap-2 rounded-panel border border-border bg-raised p-2">
  {#if declarations.length}
    <ul
      class="flex max-h-40 flex-col gap-1 overflow-y-auto text-sm"
      aria-label="Pending Declarations"
    >
      {#each declarations as d (d.id)}
        <li class="flex items-start gap-2 rounded-control bg-surface px-2 py-1">
          <span class="font-medium">{d.characterName}</span>
          {#if editing?.id === d.id}
            <form
              class="flex flex-1 flex-col gap-1"
              onsubmit={(e) => {
                e.preventDefault()
                save()
              }}
            >
              <Textarea
                size="sm"
                rows={2}
                aria-label="Edit Declaration"
                bind:value={editing.text}
              />
              <div class="flex justify-end gap-2">
                <Button size="sm" variant="ghost" type="button" onclick={() => (editing = null)}
                  >Cancel</Button
                >
                <Button size="sm" type="submit">Save</Button>
              </div>
            </form>
          {:else}
            <span class="flex-1 whitespace-pre-wrap">{d.text}</span>
            <button
              class="text-xs text-muted underline"
              aria-label="Edit {label(d)}"
              onclick={() => (editing = { id: d.id, text: d.text })}>edit</button
            >
            <button
              class="text-xs text-muted underline"
              aria-label="Withdraw {label(d)}"
              onclick={() => onwithdraw(d.id)}>withdraw</button
            >
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
  <Textarea
    size="sm"
    rows={2}
    bind:value={draft}
    {onkeydown}
    disabled={blocked}
    aria-label={acting ? `What does ${acting} do?` : 'No Character can act'}
    placeholder={acting ? `What does ${acting} do?` : 'No Character can act'}
  />
  <div class="flex items-center justify-end gap-2">
    <span class="mr-auto text-xs text-muted"
      >Enter adds to the tray · Shift+Enter for a new line</span
    >
    <Button size="sm" variant="secondary" onclick={send} disabled={blocked || !draft.trim()}
      >Send</Button
    >
  </div>
</div>
