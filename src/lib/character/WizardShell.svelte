<script lang="ts">
  import { beforeNavigate, goto } from '$app/navigation'
  import AiStatusChip from '#lib/ai/AiStatusChip.svelte'
  import { createAiStatus } from '#lib/ai/ai-status.svelte.ts'
  import Alert from '#lib/ui/Alert.svelte'
  import Button from '#lib/ui/Button.svelte'
  import Dialog from '#lib/ui/Dialog.svelte'
  import { createCharacterFieldAi } from './field-ai.svelte.ts'
  import StatsStrip from './StatsStrip.svelte'
  import StepRail from './StepRail.svelte'
  import { STEP_VIEWS } from './step-views.ts'
  import { submitDraft } from './submit.ts'
  import type { CharacterWizard } from './wizard.svelte.ts'

  type Props = {
    wizard: CharacterWizard
    /** Where the dialog's close link goes without JavaScript. */
    backHref: string
    /** Called after the player confirms abandoning the draft. */
    onabandon: () => void
  }

  let { wizard, backHref, onabandon }: Props = $props()

  // Per-field AI for every step. Each step view is keyed on the step id below, so changing
  // step unmounts it; the controller lives here, so it also aborts in-flight calls on a step
  // change (and, via its own cleanup, on leaving the wizard) and discards their results.
  const aiStatus = createAiStatus()
  // svelte-ignore state_referenced_locally
  const fieldAi = createCharacterFieldAi(wizard, aiStatus)
  // svelte-ignore state_referenced_locally
  wizard.ai = fieldAi
  $effect(() => {
    void wizard.current
    return () => fieldAi.abortAll()
  })

  let confirming = $state(false)
  /** Where an in-app navigation was headed when it was held back to ask about the draft. */
  let leavingTo = $state<URL | null>(null)
  let discarding = $state(false)

  // In-app navigation (links, back button) with unsaved changes asks first. Tab close and reload
  // are covered by `onbeforeunload` below; saving and abandoning clear `dirty` before they leave.
  beforeNavigate(({ to, type, cancel }) => {
    if (!wizard.dirty || !to || type === 'leave') return
    cancel()
    leavingTo = to.url
    discarding = true
  })
  const active = $derived(wizard.step(wizard.current))
  const View = $derived(STEP_VIEWS[wizard.current])
</script>

<svelte:window
  onbeforeunload={(e) => {
    // A reload loses the browser-only draft; ask first once there is something to lose.
    if (wizard.dirty) e.preventDefault()
  }}
/>

<main class="mx-auto grid max-w-7xl gap-4 p-4 lg:grid-cols-[13rem_1fr]">
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
    <div class="flex justify-end">
      <AiStatusChip ai={aiStatus} />
    </div>

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
        disabled={!wizard.previous || wizard.saving}
        onclick={() => wizard.previous && wizard.go(wizard.previous)}>Back</Button
      >
      {#if wizard.next}
        {@const target = wizard.next}
        <Button
          disabled={wizard.step(target)?.status === 'locked'}
          onclick={() => wizard.go(target)}>Next</Button
        >
      {:else}
        <Button
          disabled={!wizard.characterInput || wizard.saving}
          onclick={() => submitDraft(wizard)}
        >
          {wizard.saving ? 'Saving…' : wizard.characterId ? 'Save changes' : 'Save Character'}
        </Button>
      {/if}
    </div>
  </section>
</main>

<Dialog
  bind:open={discarding}
  title="Discard this Character?"
  closeHref={backHref}
  class="!w-[min(28rem,calc(100vw-2rem))]"
>
  <p class="mb-4 text-sm">
    You have unsaved changes. They live only in this browser and will be lost if you leave.
  </p>
  <div class="flex justify-end gap-2">
    <Button variant="secondary" onclick={() => (discarding = false)}>Keep editing</Button>
    <Button
      variant="danger"
      onclick={() => {
        discarding = false
        wizard.dirty = false
        // The target came from a navigation the app already resolved.
        // eslint-disable-next-line svelte/no-navigation-without-resolve
        if (leavingTo) void goto(leavingTo)
      }}>Discard</Button
    >
  </div>
</Dialog>

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
