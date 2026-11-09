<script lang="ts">
  import { tick } from 'svelte'
  import Button from './Button.svelte'
  import Select from './Select.svelte'
  import TextInput from './TextInput.svelte'
  import Textarea from './Textarea.svelte'

  type Props = {
    label: string
    kind: 'text' | 'textarea' | 'enum'
    /** The field's value. Bound so typing edits it; the parent writes AI results into it. */
    value?: string
    /** Legal choices for an `enum` field (Rules Data slugs or fixed lists). */
    options?: { value: string; label: string }[]
    rows?: number
    /** `loading` makes the field pending and swaps the icon pair for Stop. */
    status?: 'idle' | 'loading' | 'error'
    /** Message shown inline while `status` is `error`. */
    error?: string
    /** False for errors that Retry cannot fix (Dismiss only). */
    retryable?: boolean
    /** True while a one-step Undo of the last AI write is available. */
    canUndo?: boolean
    /** Disables both icons and explains why (offline, reasoning lock, archived, no legal options). */
    disabledReason?: string
    /** Archived or read-only: the field itself cannot be edited. */
    readonly?: boolean
    onGenerate: () => void
    onFeedback: (note: string) => void
    onStop: () => void
    onRetry: () => void
    onDismiss: () => void
    onUndo: () => void
  }

  let {
    label,
    kind,
    value = $bindable(''),
    options = [],
    rows = 3,
    status = 'idle',
    error = '',
    retryable = true,
    canUndo = false,
    disabledReason,
    readonly = false,
    onGenerate,
    onFeedback,
    onStop,
    onRetry,
    onDismiss,
    onUndo
  }: Props = $props()

  const uid = $props.id()
  const lower = $derived(label.toLowerCase())
  const loading = $derived(status === 'loading')
  const emptyReason = 'Nothing to give feedback on yet, use Generate'
  const generateReason = $derived(disabledReason)
  const feedbackReason = $derived(disabledReason ?? (value.trim() ? undefined : emptyReason))

  let root: HTMLElement | undefined = $state()
  let open = $state(false)
  let note = $state('')
  let tip = $state<'generate' | 'feedback' | 'stop' | undefined>()

  const tipText = $derived(
    tip === 'generate'
      ? (generateReason ?? `Generate ${lower}`)
      : tip === 'feedback'
        ? (feedbackReason ?? `Give feedback on ${lower}`)
        : tip === 'stop'
          ? `Stop generating ${lower}`
          : ''
  )

  // The popover never outlives a pending request or a newly disabled control.
  $effect(() => {
    if (loading || feedbackReason) open = false
  })

  async function toggle() {
    if (feedbackReason) return
    open = !open
    if (open) {
      note = ''
      await tick()
      root?.querySelector<HTMLElement>(`#${CSS.escape(`${uid}-note`)}`)?.focus()
    }
  }

  function close() {
    open = false
    root?.querySelector<HTMLElement>('[data-feedback-trigger]')?.focus()
  }

  function submit(e: Event) {
    e.preventDefault()
    const text = note.trim()
    if (!text) return
    open = false
    note = ''
    onFeedback(text)
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) {
      e.stopPropagation()
      close()
    }
  }

  function outside(e: MouseEvent) {
    if (open && root && !root.contains(e.target as Node)) open = false
  }

  const iconClass =
    'rounded-control px-1.5 py-0.5 text-text hover:bg-surface focus-visible:outline-2 focus-visible:outline-focus aria-disabled:cursor-not-allowed aria-disabled:opacity-50'
</script>

<svelte:window onclick={outside} />

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div class="space-y-1" bind:this={root} {onkeydown} role="group" aria-label={label}>
  <label for="{uid}-control" class="block text-sm font-medium text-text">{label}</label>
  <div class="relative">
    {#if kind === 'text'}
      <TextInput
        id="{uid}-control"
        bind:value
        readonly={readonly && !loading}
        disabled={loading}
        aria-busy={loading}
        class="pr-16"
      />
    {:else if kind === 'textarea'}
      <Textarea
        id="{uid}-control"
        {rows}
        bind:value
        readonly={readonly && !loading}
        disabled={loading}
        aria-busy={loading}
        class="pr-16"
      />
    {:else}
      <Select
        id="{uid}-control"
        bind:value
        disabled={readonly || loading}
        aria-busy={loading}
        class="pr-20"
      >
        {#each options as option (option.value)}
          <option value={option.value}>{option.label}</option>
        {/each}
      </Select>
    {/if}

    <div
      class={[
        'absolute flex gap-0.5',
        kind === 'textarea' ? 'top-1.5 right-1.5' : 'top-1/2 -translate-y-1/2',
        kind === 'enum' ? 'right-9' : kind === 'text' ? 'right-1.5' : ''
      ]}
    >
      {#if loading}
        <button
          type="button"
          class={iconClass}
          aria-label="Stop generating {label}"
          aria-describedby={tip === 'stop' ? `${uid}-tip` : undefined}
          onclick={onStop}
          onmouseenter={() => (tip = 'stop')}
          onmouseleave={() => (tip = undefined)}
          onfocus={() => (tip = 'stop')}
          onblur={() => (tip = undefined)}>■</button
        >
      {:else}
        <button
          type="button"
          class={iconClass}
          aria-label="Generate {label}"
          aria-disabled={generateReason ? 'true' : undefined}
          aria-describedby={tip === 'generate' ? `${uid}-tip` : undefined}
          onclick={() => {
            if (!generateReason) onGenerate()
          }}
          onmouseenter={() => (tip = 'generate')}
          onmouseleave={() => (tip = undefined)}
          onfocus={() => (tip = 'generate')}
          onblur={() => (tip = undefined)}>✦</button
        >
        <button
          type="button"
          class={iconClass}
          data-feedback-trigger
          aria-label="Give feedback on {label}"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-disabled={feedbackReason ? 'true' : undefined}
          aria-describedby={tip === 'feedback' ? `${uid}-tip` : undefined}
          onclick={toggle}
          onmouseenter={() => (tip = 'feedback')}
          onmouseleave={() => (tip = undefined)}
          onfocus={() => (tip = 'feedback')}
          onblur={() => (tip = undefined)}>✎</button
        >
      {/if}
    </div>

    {#if tip}
      <div
        id="{uid}-tip"
        role="tooltip"
        class="pointer-events-none absolute right-0 z-20 mt-1 max-w-64 rounded-control border border-control-border bg-raised px-2 py-1 text-xs text-text shadow-lg"
      >
        {tipText}
      </div>
    {/if}

    {#if open}
      <div
        role="dialog"
        aria-label="Feedback on {label}"
        class="absolute right-0 z-10 mt-1 w-72 rounded-control border border-control-border bg-raised p-3 shadow-lg"
      >
        <form onsubmit={submit} class="space-y-2">
          <p class="text-xs text-muted">Current {lower}</p>
          <p class="line-clamp-3 rounded-control bg-surface px-2 py-1 text-sm break-words">
            {value}
          </p>
          <label for="{uid}-note" class="block text-sm font-medium text-text"
            >What should change?</label
          >
          <Textarea
            id="{uid}-note"
            size="sm"
            rows={2}
            bind:value={note}
            placeholder="e.g. darker, shorter"
            onkeydown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e)
            }}
          />
          <div class="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onclick={close}>Cancel</Button>
            <Button type="submit" size="sm" disabled={!note.trim()}>Revise</Button>
          </div>
        </form>
      </div>
    {/if}
  </div>

  <div role="status" class="text-sm text-muted">
    {#if loading}
      Generating {lower}…
    {:else if canUndo && status !== 'error'}
      {label} updated by AI.
      <button type="button" class="font-medium text-text underline" onclick={onUndo}>Undo</button>
    {/if}
  </div>
  {#if status === 'error'}
    <p role="alert" class="text-sm font-medium text-danger">
      {error}
      {#if retryable}
        <button type="button" class="underline" onclick={onRetry}>Retry</button>
      {/if}
      <button type="button" class="underline" onclick={onDismiss}>Dismiss</button>
    </p>
  {/if}
</div>
