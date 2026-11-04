<!-- PROTOTYPE variant A, "Rail + panel": vertical step rail left, step centre, chat right. Cards live in the chat. -->
<script lang="ts">
  import Button from '#lib/ui/Button.svelte'
  import Chat from './Chat.svelte'
  import Notices from './Notices.svelte'
  import Stats from './Stats.svelte'
  import StepBody from './StepBody.svelte'
  import { STEP_LABELS, type Wizard } from './model.svelte.ts'

  let { w }: { w: Wizard } = $props()
  const icon = { locked: '🔒', incomplete: '○', attention: '⚠', valid: '✓' } as const
</script>

<main class="mx-auto grid max-w-7xl gap-4 p-4 lg:grid-cols-[13rem_1fr_22rem]">
  <nav aria-label="Steps" class="space-y-1 lg:sticky lg:top-4 lg:self-start">
    <h1 class="font-display text-xl">New character</h1>
    {#each w.steps as s, i (s)}
      {@const st = w.status(s)}
      <button
        type="button"
        disabled={st === 'locked'}
        aria-current={w.current === s ? 'step' : undefined}
        class="flex w-full items-center gap-2 rounded-control border px-3 py-2 text-left text-sm disabled:opacity-50 {w.current ===
        s
          ? 'border-primary bg-raised font-semibold'
          : 'border-transparent hover:bg-raised'}"
        onclick={() => w.go(s)}
      >
        <span
          class="w-4 {st === 'attention' ? 'text-warning' : st === 'valid' ? 'text-success' : ''}"
          >{icon[st]}</span
        >
        <span>{i + 1}. {STEP_LABELS[s]}</span>
        {#if s !== 'concept' && s !== 'review' && st === 'incomplete' && w.pending(s).length}<span
            class="ml-auto h-2 w-2 rounded-full bg-primary"
            title="AI has suggestions"
          ></span>{/if}
      </button>
    {/each}
    <Button
      variant="ghost"
      size="sm"
      class="mt-3"
      onclick={() => confirm('Abandon this character?')}>Abandon</Button
    >
  </nav>

  <section class="space-y-4">
    <Notices {w} />
    <Stats {w} mode="strip" />
    <div class="space-y-4 rounded-panel border border-border bg-surface p-4">
      <h2 class="font-display text-xl">{STEP_LABELS[w.current]}</h2>
      <StepBody {w} />
    </div>
    <div class="flex justify-between">
      <Button variant="secondary" disabled={!w.prev} onclick={() => w.prev && w.go(w.prev)}
        >Back</Button
      >
      <Button
        disabled={!w.next || w.status(w.next) === 'locked'}
        onclick={() => w.next && w.go(w.next)}>Next</Button
      >
    </div>
  </section>

  <aside class="lg:sticky lg:top-4 lg:h-[calc(100vh-6rem)] lg:self-start"><Chat {w} tall /></aside>
</main>
