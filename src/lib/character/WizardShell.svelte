<script lang="ts">
  import type { Snippet } from 'svelte'
  import Alert from '#lib/ui/Alert.svelte'
  import Button from '#lib/ui/Button.svelte'
  import Dialog from '#lib/ui/Dialog.svelte'
  import StatsStrip from './StatsStrip.svelte'
  import StepRail from './StepRail.svelte'
  import { STEP_VIEWS } from './step-views.ts'
  import type { CharacterWizard } from './wizard.svelte.ts'

  type Props = {
    wizard: CharacterWizard
    /** Where the dialog's close link goes without JavaScript. */
    backHref: string
    /** Called after the player confirms abandoning the draft. */
    onabandon: () => void
    /**
     * The persistent creation conversation (#116). Rendered in the right column on every step;
     * when absent the layout is two columns.
     */
    aside?: Snippet
  }

  let { wizard, backHref, onabandon, aside }: Props = $props()

  let confirming = $state(false)
  const active = $derived(wizard.step(wizard.current))
  const View = $derived(STEP_VIEWS[wizard.current])
  const next = $derived(wizard.next ? wizard.step(wizard.next) : undefined)
</script>

<svelte:window
  onbeforeunload={(e) => {
    // A reload loses the browser-only draft; ask first once there is something to lose.
    if (wizard.dirty) e.preventDefault()
  }}
/>

<main
  class={[
    'mx-auto grid max-w-7xl gap-4 p-4',
    aside ? 'lg:grid-cols-[13rem_1fr_22rem]' : 'lg:grid-cols-[13rem_1fr]'
  ]}
>
  <div class="lg:sticky lg:top-4 lg:self-start">
    <StepRail
      steps={wizard.steps.map((s) => ({
        ...s,
        suggestions: wizard.suggestions[s.id] ?? 0
      }))}
      current={wizard.current}
      onselect={(id) => wizard.go(id)}
      onabandon={() => (confirming = true)}
    />
  </div>

  <section class="min-w-0 space-y-4">
    {#each wizard.notices as notice, i (i + notice)}
      <Alert variant="info" class="flex items-center justify-between gap-2">
        <span>{notice}</span>
        <Button type="button" variant="ghost" size="sm" onclick={() => wizard.dismissNotice(i)}
          >Dismiss</Button
        >
      </Alert>
    {/each}

    <StatsStrip stats={wizard.stats} />

    <div class="space-y-4 rounded-panel border border-border bg-surface p-4">
      <h2 class="font-display text-xl">{active?.label}</h2>
      {#if active && active.issues.length > 0 && active.status !== 'locked'}
        <ul class="list-disc pl-5 text-sm text-muted" aria-label="What is left in this step">
          {#each active.issues as issue (issue)}<li>{issue}</li>{/each}
        </ul>
      {/if}
      <View {wizard} />
    </div>

    <div class="flex justify-between">
      <Button
        variant="secondary"
        disabled={!wizard.previous}
        onclick={() => wizard.previous && wizard.go(wizard.previous)}>Back</Button
      >
      <Button
        disabled={!next || next.status === 'locked'}
        onclick={() => wizard.next && wizard.go(wizard.next)}>Next</Button
      >
    </div>
  </section>

  {#if aside}
    <aside aria-label="Creation conversation" class="lg:sticky lg:top-4 lg:self-start">
      {@render aside()}
    </aside>
  {/if}
</main>

<Dialog
  bind:open={confirming}
  title="Abandon this Character?"
  closeHref={backHref}
  class="!w-[min(28rem,calc(100vw-2rem))]"
>
  <p class="mb-4 text-sm">
    Your draft lives only in this browser and has not been saved. Abandoning it discards everything
    you have entered.
  </p>
  <div class="flex justify-end gap-2">
    <Button variant="secondary" onclick={() => (confirming = false)}>Keep editing</Button>
    <Button
      variant="danger"
      onclick={() => {
        confirming = false
        wizard.dirty = false
        onabandon()
      }}>Abandon</Button
    >
  </div>
</Dialog>
