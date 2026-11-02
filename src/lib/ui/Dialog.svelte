<script lang="ts">
  import { onMount, type Snippet } from 'svelte'
  import type { HTMLDialogAttributes } from 'svelte/elements'
  import Button from '#lib/ui/Button.svelte'

  type Props = {
    open?: boolean
    /** Accessible name and visible heading. */
    title: string
    /** Where the close link goes when JavaScript is unavailable. */
    closeHref: string
    onclose?: () => void
    children?: Snippet
  } & Omit<HTMLDialogAttributes, 'children' | 'open' | 'onclose' | 'title'>

  let {
    open = $bindable(false),
    title,
    closeHref,
    onclose,
    class: className,
    children,
    ...rest
  }: Props = $props()

  let dialog: HTMLDialogElement | undefined = $state()

  // A server-rendered open dialog is non-modal; upgrade it once JS runs.
  onMount(() => {
    if (dialog?.open) {
      dialog.close()
      dialog.showModal()
    }
  })

  $effect(() => {
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  })
</script>

<dialog
  bind:this={dialog}
  {open}
  aria-label={title}
  onclose={() => {
    // The upgrade closes and reopens; only a dialog that stayed closed counts.
    open = dialog?.open ?? false
    if (!open) onclose?.()
  }}
  class={[
    'm-auto w-[min(72rem,calc(100vw-2rem))] rounded-panel border border-border bg-surface p-6 text-text shadow-overlay backdrop:bg-black/50',
    className
  ]}
  {...rest}
>
  <div class="mb-4 flex items-center justify-between">
    <h2 class="font-display text-xl">{title}</h2>
    <Button
      variant="ghost"
      size="sm"
      href={closeHref}
      class="underline"
      onclick={(e: MouseEvent) => {
        e.preventDefault()
        dialog?.close()
      }}>Close</Button
    >
  </div>
  {@render children?.()}
</dialog>
