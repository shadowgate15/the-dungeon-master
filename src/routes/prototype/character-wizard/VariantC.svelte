<!-- PROTOTYPE variant C, "Conversation-first": chat is the main stage with cards in the transcript;
     the step form is a docked panel underneath; steps are pills; stats are a chip row. -->
<script lang="ts">
  import Button from '#lib/ui/Button.svelte'
  import Chat from './Chat.svelte'
  import Notices from './Notices.svelte'
  import Stats from './Stats.svelte'
  import StepBody from './StepBody.svelte'
  import { STEP_LABELS, type Wizard } from './model.svelte.ts'

  let { w }: { w: Wizard } = $props()
  let dock = $state(true)
  const mark = { locked: ' 🔒', incomplete: '', attention: ' ⚠', valid: ' ✓' } as const
</script>

<main class="mx-auto flex min-h-[calc(100vh-3rem)] max-w-3xl flex-col gap-3 p-4">
  <header class="flex flex-wrap items-center justify-between gap-2">
    <h1 class="font-display text-xl">{w.name || 'New character'}</h1>
    <Stats {w} mode="chips" />
  </header>

  <nav class="flex flex-wrap gap-1.5" aria-label="Steps">
    {#each w.steps as s (s)}
      {@const st = w.status(s)}
      <button
        type="button"
        disabled={st === 'locked'}
        aria-current={w.current === s ? 'step' : undefined}
        class="rounded-full border px-3 py-1 text-sm disabled:opacity-50 {w.current === s
          ? 'border-transparent bg-primary text-on-primary'
          : st === 'attention'
            ? 'border-warning bg-warning-bg'
            : 'border-control-border bg-raised'}"
        onclick={() => {
          w.go(s)
          dock = true
        }}>{STEP_LABELS[s]}{mark[st]}</button
      >
    {/each}
  </nav>

  <Notices {w} />

  <div class="flex-1"><Chat {w} /></div>

  <section
    class="sticky bottom-2 space-y-3 rounded-panel border border-border bg-surface p-4 shadow-raised"
    aria-label="{STEP_LABELS[w.current]} step"
  >
    <button
      type="button"
      class="flex w-full items-center justify-between font-display text-lg"
      aria-expanded={dock}
      onclick={() => (dock = !dock)}
    >
      <span>{STEP_LABELS[w.current]}</span><span class="text-sm"
        >{dock ? 'Collapse ▾' : 'Edit ▴'}</span
      >
    </button>
    {#if dock}
      <div class="max-h-[45vh] overflow-y-auto"><StepBody {w} /></div>
      <div class="flex justify-between">
        <Button variant="secondary" disabled={!w.prev} onclick={() => w.prev && w.go(w.prev)}
          >Back</Button
        >
        <Button
          disabled={!w.next || w.status(w.next) === 'locked'}
          onclick={() => w.next && w.go(w.next)}>Next</Button
        >
      </div>
    {/if}
  </section>
</main>
