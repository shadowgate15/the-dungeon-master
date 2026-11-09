<script lang="ts">
  // PROTOTYPE (throwaway): one demo field rendered with whichever variant is chosen.
  import Select from '../Select.svelte'
  import TextInput from '../TextInput.svelte'
  import Textarea from '../Textarea.svelte'
  import Button from '../Button.svelte'
  import FeedbackForm from './FeedbackForm.svelte'
  import { blockedText, type Blocked, type FieldAi } from './controller.svelte'

  type Props = {
    variant: 'A' | 'B' | 'C'
    label: string
    kind: 'text' | 'textarea' | 'enum'
    ai: FieldAi
    blocked?: Blocked
  }
  let { variant, label, kind, ai, blocked }: Props = $props()

  const uid = $props.id()
  let open = $state(false)
  let root: HTMLElement | undefined = $state()
  const busy = $derived(ai.status === 'loading')
  const off = $derived(!!blocked)
  const why = $derived(blocked ? blockedText[blocked] : '')
  const ro = $derived(blocked === 'archived' || blocked === 'read-only')

  function close() {
    open = false
    root?.querySelector<HTMLElement>('[data-trigger]')?.focus()
  }
  function onkey(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) {
      e.stopPropagation()
      close()
    }
  }
  function outside(e: MouseEvent) {
    if (open && root && !root.contains(e.target as Node)) open = false
  }
</script>

<svelte:window onclick={outside} />

{#snippet control()}
  {#if kind === 'text'}
    <TextInput id="{uid}-c" bind:value={ai.value} readonly={ro} disabled={busy} aria-busy={busy} />
  {:else if kind === 'textarea'}
    <Textarea
      id="{uid}-c"
      rows={3}
      bind:value={ai.value}
      readonly={ro}
      disabled={busy}
      aria-busy={busy}
    />
  {:else}
    <Select id="{uid}-c" bind:value={ai.value} disabled={ro || busy} aria-busy={busy}>
      {#each ai.options ?? [] as o (o)}<option>{o}</option>{/each}
    </Select>
  {/if}
{/snippet}

{#snippet spinner()}
  <span
    class="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
    aria-hidden="true"
  ></span>
{/snippet}

{#snippet status()}
  <!-- polite live region: announces result/undo/error to screen readers -->
  <div class="min-h-5 text-sm" aria-live="polite">
    {#if busy}
      <span class="text-muted">Generating {label.toLowerCase()}…</span>
    {:else if ai.status === 'error'}
      <span role="alert" class="font-medium text-danger"
        >{ai.error}
        <button
          class="underline"
          onclick={() => (ai.lastNote ? ai.revise(ai.lastNote) : ai.generate())}>Retry</button
        >
        <button class="underline" onclick={() => ai.dismissError()}>Dismiss</button></span
      >
    {:else if ai.undoValue !== undefined}
      <span class="text-muted"
        >{label} updated by AI.
        <button class="font-medium text-text underline" onclick={() => ai.undo()}>Undo</button
        ></span
      >
    {/if}
  </div>
{/snippet}

<div class="space-y-1" bind:this={root} onkeydown={onkey} role="group" aria-label={label}>
  {#if variant === 'A'}
    <!-- A: split button in the label row; popover drops from the chevron half -->
    <div class="flex items-end justify-between gap-2">
      <label for="{uid}-c" class="text-sm font-medium">{label}</label>
      <div class="relative">
        {#if busy}
          <Button
            size="sm"
            variant="secondary"
            onclick={() => ai.cancel()}
            aria-label="Stop generating {label}">{@render spinner()} Stop</Button
          >
        {:else}
          <span class="inline-flex" title={why}>
            <Button
              size="sm"
              variant="secondary"
              class="rounded-r-none"
              disabled={off}
              onclick={() => ai.generate()}
              aria-label="Generate {label}">✦ Generate</Button
            >
            <Button
              data-trigger
              size="sm"
              variant="secondary"
              class="-ml-px rounded-l-none"
              disabled={off}
              aria-haspopup="dialog"
              aria-expanded={open}
              aria-label="Give feedback on {label}"
              onclick={() => (open = !open)}>▾</Button
            >
          </span>
        {/if}
        {#if open}
          <div
            role="dialog"
            aria-label="Feedback on {label}"
            class="absolute right-0 z-10 mt-1 w-72 rounded-control border border-control-border bg-raised p-3 shadow-lg"
          >
            <FeedbackForm {ai} {label} onclose={close} />
          </div>
        {/if}
      </div>
    </div>
    {@render control()}
    {@render status()}
  {:else if variant === 'B'}
    <!-- B: icon-only pair floating in the field's corner; label row stays clean -->
    <label for="{uid}-c" class="block text-sm font-medium">{label}</label>
    <div class="relative">
      {@render control()}
      <div
        class="absolute {kind === 'textarea' ? 'top-1.5' : 'top-1/2 -translate-y-1/2'} {kind ===
        'enum'
          ? 'right-9'
          : 'right-1.5'} flex gap-0.5"
        title={why}
      >
        {#if busy}
          <button
            class="rounded-control px-1.5 py-0.5 text-sm hover:bg-surface focus-visible:outline-2 focus-visible:outline-focus"
            onclick={() => ai.cancel()}
            aria-label="Stop generating {label}">■</button
          >
        {:else}
          <button
            class="rounded-control px-1.5 py-0.5 hover:bg-surface focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-50"
            disabled={off}
            onclick={() => ai.generate()}
            aria-label="Generate {label}"
            title="Generate">✦</button
          >
          <button
            data-trigger
            class="rounded-control px-1.5 py-0.5 hover:bg-surface focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-50"
            disabled={off}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-label="Give feedback on {label}"
            title="Give feedback"
            onclick={() => (open = !open)}>✎</button
          >
        {/if}
      </div>
      {#if open}
        <div
          role="dialog"
          aria-label="Feedback on {label}"
          class="absolute right-0 z-10 mt-1 w-72 rounded-control border border-control-border bg-raised p-3 shadow-lg"
        >
          <FeedbackForm {ai} {label} onclose={close} />
        </div>
      {/if}
    </div>
    {@render status()}
  {:else}
    <!-- C: state-aware labels under the field; feedback opens inline (no floating popover) -->
    <label for="{uid}-c" class="block text-sm font-medium">{label}</label>
    <div class={busy ? 'animate-pulse' : ''}>{@render control()}</div>
    <div class="flex flex-wrap items-center gap-2" title={why}>
      {#if busy}
        <Button size="sm" variant="ghost" onclick={() => ai.cancel()}
          >{@render spinner()} Stop</Button
        >
      {:else}
        <Button size="sm" variant="ghost" disabled={off} onclick={() => ai.generate()}
          >✦ {ai.value ? 'Regenerate' : 'Generate'}</Button
        >
        {#if ai.value}
          <Button
            data-trigger
            size="sm"
            variant="ghost"
            disabled={off}
            aria-expanded={open}
            onclick={() => (open = !open)}>Revise…</Button
          >
        {/if}
        {#if ai.undoValue !== undefined}
          <Button size="sm" variant="ghost" onclick={() => ai.undo()}>↶ Undo</Button>
        {/if}
      {/if}
      {#if off}<span class="text-sm text-muted">{why}</span>{/if}
    </div>
    {#if open}
      <div class="rounded-control border border-control-border bg-raised p-3">
        <FeedbackForm {ai} {label} onclose={close} />
      </div>
    {/if}
    {#if ai.status === 'error' || busy}{@render status()}{/if}
  {/if}
  {#if off && variant !== 'C'}<p class="text-xs text-muted">{why}</p>{/if}
</div>
