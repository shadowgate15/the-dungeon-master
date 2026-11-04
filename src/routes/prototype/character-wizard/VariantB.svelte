<!-- PROTOTYPE variant B, "Sheet-first": horizontal stepper, step + live character sheet, chat in a bottom drawer.
     Proposal cards appear inline at the top of the step they target. -->
<script lang="ts">
  import Button from '#lib/ui/Button.svelte'
  import Chat from './Chat.svelte'
  import Notices from './Notices.svelte'
  import Stats from './Stats.svelte'
  import StepBody from './StepBody.svelte'
  import { STEP_LABELS, type Wizard } from './model.svelte.ts'

  let { w }: { w: Wizard } = $props()
  let open = $state(false)
  const icon = { locked: '🔒', incomplete: '', attention: '⚠', valid: '✓' } as const
</script>

<main class="mx-auto max-w-6xl space-y-4 p-4 pb-24">
  <header class="flex items-center justify-between">
    <h1 class="font-display text-xl">New character</h1>
    <Button variant="ghost" size="sm" onclick={() => confirm('Abandon this character?')}
      >Abandon</Button
    >
  </header>

  <ol class="flex gap-1 overflow-x-auto" aria-label="Steps">
    {#each w.steps as s, i (s)}
      {@const st = w.status(s)}
      <li class="flex-1">
        <button
          type="button"
          disabled={st === 'locked'}
          aria-current={w.current === s ? 'step' : undefined}
          class="w-full border-b-4 px-2 py-2 text-sm whitespace-nowrap disabled:opacity-50 {w.current ===
          s
            ? 'border-primary font-semibold'
            : st === 'valid'
              ? 'border-success'
              : st === 'attention'
                ? 'border-warning'
                : 'border-border'}"
          onclick={() => w.go(s)}
          >{i + 1}. {STEP_LABELS[s]}
          {icon[st]}
          {#if w.pending(s).length && w.current !== s}<span
              class="ml-1 rounded-full bg-primary px-1.5 text-xs text-on-primary"
              >{w.pending(s).length}</span
            >{/if}</button
        >
      </li>
    {/each}
  </ol>

  <Notices {w} />

  <div class="grid gap-4 md:grid-cols-[1fr_20rem]">
    <section class="space-y-4 rounded-panel border border-border bg-surface p-4">
      <h2 class="font-display text-xl">{STEP_LABELS[w.current]}</h2>
      <StepBody {w} inlineProposals />
      <div class="flex justify-between border-t border-border pt-3">
        <Button variant="secondary" disabled={!w.prev} onclick={() => w.prev && w.go(w.prev)}
          >Back</Button
        >
        <Button
          disabled={!w.next || w.status(w.next) === 'locked'}
          onclick={() => w.next && w.go(w.next)}>Next</Button
        >
      </div>
    </section>
    <aside
      class="rounded-panel border border-border bg-surface p-4 md:sticky md:top-4 md:self-start"
    >
      <Stats {w} mode="sheet" />
    </aside>
  </div>
</main>

<div class="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface shadow-raised">
  <button
    type="button"
    class="flex w-full items-center justify-between px-4 py-2 text-sm font-medium"
    aria-expanded={open}
    onclick={() => (open = !open)}
  >
    <span
      >💬 Creation conversation {#if w.pending(w.current).length}<span
          class="ml-2 rounded-full bg-primary px-2 text-xs text-on-primary"
          >{w.pending(w.current).length} suggestion{w.pending(w.current).length > 1 ? 's' : ''} for this
          step</span
        >{/if}</span
    >
    <span>{open ? '▾' : '▴'}</span>
  </button>
  {#if open}<div class="mx-auto max-w-3xl p-4 pt-0"><Chat {w} cardsInChat={false} /></div>{/if}
</div>
