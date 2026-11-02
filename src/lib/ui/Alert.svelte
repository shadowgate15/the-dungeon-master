<script lang="ts" module>
  export type AlertVariant = 'info' | 'success' | 'warning' | 'danger'
</script>

<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'

  type Props = {
    variant?: AlertVariant
    children?: Snippet
  } & Omit<HTMLAttributes<HTMLDivElement>, 'children'>

  let { variant = 'info', class: className, children, ...rest }: Props = $props()

  const variants: Record<AlertVariant, string> = {
    info: 'bg-info-bg text-info border-info',
    success: 'bg-success-bg text-success border-success',
    warning: 'bg-warning-bg text-warning border-warning',
    danger: 'bg-danger-bg text-danger border-danger'
  }
  // Urgent variants interrupt; informational ones are announced politely.
  const role = $derived(variant === 'danger' || variant === 'warning' ? 'alert' : 'status')
</script>

<div
  {role}
  class={['rounded-control border px-3 py-2 text-sm', variants[variant], className]}
  {...rest}
>
  {@render children?.()}
</div>
