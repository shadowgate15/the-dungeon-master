<script lang="ts">
  // PROTOTYPE: Floor composer — "Acting as" picker, pending tray, Send / Done / Send & Done.
  import Button from '#lib/ui/Button.svelte'
  import { party } from './play-mock.ts'

  let {
    combat,
    busy,
    onsend,
    showPicker = true,
    actingAs = $bindable('Bram')
  }: {
    combat: boolean
    busy: boolean
    onsend: () => void
    showPicker?: boolean
    actingAs?: string
  } = $props()

  const inScene = party.filter((c) => c.whereabouts === null)
  const elsewhere = party.filter((c) => c.whereabouts !== null)
  let draft = $state('')
  let tray = $state<{ who: string; text: string }[]>([
    { who: 'Wren', text: 'I grab Marrow by the collar before he can slip away.' }
  ])

  function add() {
    if (!draft.trim()) return
    tray.push({ who: actingAs, text: draft.trim() })
    draft = ''
  }
  function done() {
    tray = []
    onsend()
  }
  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      add()
      done()
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      add()
    }
  }
</script>

<div class="flex flex-col gap-2 rounded-panel border border-border bg-raised p-2">
  {#if tray.length}
    <ul class="flex flex-col gap-1 text-sm" aria-label="Pending Declarations">
      {#each tray as d, i (i)}
        <li class="flex items-center gap-2 rounded-control bg-surface px-2 py-1">
          <span class="font-medium">{d.who}</span>
          <span class="flex-1">{d.text}</span>
          <button class="text-xs text-muted underline" onclick={() => tray.splice(i, 1)}
            >withdraw</button
          >
        </li>
      {/each}
    </ul>
  {/if}
  <div class="flex flex-wrap items-center gap-2 text-sm">
    {#if showPicker}
      <span class="text-muted">Acting as</span>
      {#if combat}
        <span class="rounded-control bg-primary px-2 py-0.5 text-on-primary"
          >{actingAs} <span class="opacity-70">(their turn)</span></span
        >
      {:else}
        {#each inScene as c (c.handle)}
          <button
            class={[
              'rounded-control border px-2 py-0.5',
              actingAs === c.name
                ? 'border-transparent bg-primary text-on-primary'
                : 'border-control-border'
            ]}
            onclick={() => (actingAs = c.name)}>{c.name}</button
          >
        {/each}
      {/if}
    {/if}
    {#each elsewhere as c (c.handle)}
      <span class="rounded-control border border-dashed border-border px-2 py-0.5 text-muted"
        >{c.name} · elsewhere: {c.whereabouts}
        <button class="ml-1 underline">Cut to {c.name}</button></span
      >
    {/each}
  </div>
  <textarea
    bind:value={draft}
    {onkeydown}
    rows="2"
    placeholder={busy
      ? 'The DM is answering… you can draft the next move'
      : `What does ${actingAs} do?`}
    class="w-full rounded-control border-control-border bg-surface text-sm"></textarea>
  <div class="flex items-center justify-end gap-2">
    <span class="mr-auto text-xs text-muted">Enter adds · Ctrl+Enter sends & ends the turn</span>
    <Button size="sm" variant="secondary" onclick={add} disabled={busy}>Send</Button>
    <Button size="sm" onclick={done} disabled={busy}
      >Done{tray.length ? ` (${tray.length})` : ''}</Button
    >
  </div>
</div>
