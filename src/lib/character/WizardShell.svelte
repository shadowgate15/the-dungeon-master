<script lang="ts">
  import { beforeNavigate, goto } from '$app/navigation'
  import Alert from '#lib/ui/Alert.svelte'
  import Button from '#lib/ui/Button.svelte'
  import Dialog from '#lib/ui/Dialog.svelte'
  import StatsStrip from './StatsStrip.svelte'
  import StepRail from './StepRail.svelte'
  import { STEP_VIEWS } from './step-views.ts'
  import { draftWrite, submitDraft } from './submit.ts'
  import type { CharacterWizard } from './wizard.svelte.ts'

  type Props = {
    wizard: CharacterWizard
    /** Where the dialog's close link goes without JavaScript. */
    backHref: string
    /** Called after the player confirms abandoning the draft. */
    onabandon: () => void
  }

  let { wizard, backHref, onabandon }: Props = $props()

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

  // A draft stored with the Campaign is written shortly after each change and each step move, so
  // a reload loses nothing. `dirty` holds while a write is pending, which keeps the leave guards on.
  let draftSaved = $state(false)
  let latest = 0
  let opened = false
  $effect(() => {
    const target = wizard.target
    if (!target || !('draft' in target)) return
    const { url, init } = draftWrite(target, wizard)
    if (!opened) {
      opened = true
      return
    }
    const request = ++latest
    wizard.dirty = true
    draftSaved = false
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(url, init)
        if (response.ok && request === latest) {
          wizard.dirty = false
          draftSaved = true
        }
      } catch {
        // Kept dirty: the next change tries again, and leaving still asks first.
      }
    }, 300)
    return () => clearTimeout(timer)
  })

  const active = $derived(wizard.step(wizard.current))
  const View = $derived(STEP_VIEWS[wizard.current])
  /** The steps keeping Review locked, so the player sees why Next cannot get there. */
  const blockingReview = $derived(
    wizard.steps.some((s) => s.id === 'review' && s.status === 'locked')
      ? wizard.steps.filter((s) => s.id !== 'review' && s.status !== 'valid').map((s) => s.label)
      : []
  )
</script>

<svelte:window
  onbeforeunload={(e) => {
    // A reload before the pending draft write lands would lose it; ask first.
    if (wizard.dirty) e.preventDefault()
  }}
/>

<section aria-label="Character wizard" class="grid gap-4 lg:grid-cols-[13rem_1fr]">
  <div class="lg:sticky lg:top-4 lg:self-start">
    <StepRail
      steps={wizard.steps}
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

    {#if draftSaved}
      <p class="text-sm text-muted" role="status">Draft saved</p>
    {/if}

    {#if blockingReview.length > 0}
      <p class="text-sm text-muted" data-testid="review-blockers">
        Review unlocks when every step is done. Still open: {blockingReview.join(', ')}.
      </p>
    {/if}

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
          onclick={() => submitDraft(wizard, backHref)}
        >
          {wizard.saving ? 'Saving…' : wizard.characterId ? 'Save changes' : 'Save Character'}
        </Button>
      {/if}
    </div>
  </section>
</section>

<Dialog
  bind:open={discarding}
  title="Discard this Character?"
  closeHref={backHref}
  class="!w-[min(28rem,calc(100vw-2rem))]"
>
  <p class="mb-4 text-sm">You have unsaved changes. They will be lost if you leave.</p>
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
    This Character has not been saved. Abandoning it discards the draft and everything you have
    entered.
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
