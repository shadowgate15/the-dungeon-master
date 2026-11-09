<script lang="ts">
  // PROTOTYPE (throwaway)
  import Button from '../Button.svelte'
  import Textarea from '../Textarea.svelte'
  import type { FieldAi } from './controller.svelte'

  let { ai, label, onclose }: { ai: FieldAi; label: string; onclose: () => void } = $props()
  let note = $state('')
  const uid = $props.id()
  function submit(e: Event) {
    e.preventDefault()
    if (!note.trim()) return
    ai.revise(note.trim())
    note = ''
    onclose()
  }
</script>

<form onsubmit={submit} class="space-y-2">
  <p class="text-xs text-muted">Current {label.toLowerCase()}</p>
  <p class="line-clamp-2 rounded-control bg-surface px-2 py-1 text-sm">{ai.value || '(empty)'}</p>
  <label for="{uid}-note" class="block text-sm font-medium">What should change?</label>
  <Textarea
    id="{uid}-note"
    size="sm"
    rows={2}
    bind:value={note}
    placeholder="e.g. darker, shorter, less nautical"
    autofocus
    onkeydown={(e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e)
    }}
  />
  <div class="flex justify-end gap-2">
    <Button type="button" size="sm" variant="ghost" onclick={onclose}>Cancel</Button>
    <Button type="submit" size="sm" disabled={!note.trim()}>Revise</Button>
  </div>
</form>
