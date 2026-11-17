<!-- PROTOTYPE (throwaway): the input, with optional state-derived affordance chips. -->
<script lang="ts">
  import type { SceneStore } from './store.svelte.ts'

  let { store }: { store: SceneStore } = $props()

  const locked = $derived(store.busy || !!store.state.pendingRoll)

  const chips = $derived.by(() => {
    const s = store.state
    const out: { label: string; text: string }[] = []
    if (s.mode === 'dialogue') {
      out.push(
        { label: 'Ask for news', text: 'I ask what news or rumors they have.' },
        { label: 'Press them', text: 'I press them for more, lowering my voice.' },
        { label: 'End conversation', text: 'I thank them and end the conversation.' }
      )
    } else {
      for (const n of s.npcsPresent)
        out.push({ label: `Talk to ${n.name}`, text: `I talk to ${n.name}.` })
      for (const e of s.location.exits)
        out.push({ label: `Go: ${e.label}`, text: `I head to ${e.label}.` })
      for (const o of s.location.objects)
        out.push({ label: `Examine ${o}`, text: `I examine ${o}.` })
    }
    return out
  })

  function onkeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void store.send()
    }
  }
</script>

<div class="space-y-2">
  {#if store.affordances}
    <div class="flex flex-wrap gap-1.5">
      {#each chips as chip (chip.label)}
        <button
          type="button"
          class="rounded-full border border-border bg-raised px-2.5 py-0.5 text-xs hover:bg-surface disabled:opacity-50"
          disabled={locked}
          onclick={() => store.fill(chip.text)}>{chip.label}</button
        >
      {/each}
    </div>
  {/if}
  <div class="flex items-end gap-2">
    <textarea
      rows="2"
      class="min-h-0 flex-1 rounded-control border border-control-border bg-raised p-2 disabled:opacity-60"
      placeholder={store.state.pendingRoll ? 'Roll first…' : 'What do you do?'}
      disabled={locked}
      bind:value={store.draft}
      {onkeydown}></textarea>
    {#if store.busy}
      <button
        type="button"
        class="rounded-control bg-danger-bg px-4 py-2 text-danger"
        onclick={() => store.stop()}>Stop</button
      >
    {:else}
      <button
        type="button"
        class="rounded-control bg-primary px-4 py-2 text-on-primary disabled:opacity-50"
        disabled={locked || !store.draft.trim()}
        onclick={() => store.send()}>Send</button
      >
    {/if}
  </div>
</div>
