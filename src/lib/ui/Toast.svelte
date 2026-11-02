<script lang="ts" module>
  export type ToastTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'
</script>

<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'
  import Button from './Button.svelte'

  type Props = {
    tone?: ToastTone
    /** Shows a dismiss button when given. */
    onclose?: () => void
    children?: Snippet
  } & Omit<HTMLAttributes<HTMLDivElement>, 'children'>

  let { tone = 'neutral', onclose, class: className, children, ...rest }: Props = $props()

  const tones: Record<ToastTone, string> = {
    neutral: 'bg-raised text-text border-border',
    info: 'bg-info-bg text-info border-info',
    success: 'bg-success-bg text-success border-success',
    warning: 'bg-warning-bg text-warning border-warning',
    danger: 'bg-danger-bg text-danger border-danger'
  }
</script>

<div
  role="status"
  class={[
    'fixed right-4 bottom-4 z-40 flex items-center gap-3 rounded-control border px-4 py-2 text-sm shadow-overlay',
    tones[tone],
    className
  ]}
  {...rest}
>
  {@render children?.()}
  {#if onclose}
    <Button variant="ghost" size="sm" type="button" aria-label="Dismiss" onclick={() => onclose()}
      >✕</Button
    >
  {/if}
</div>
