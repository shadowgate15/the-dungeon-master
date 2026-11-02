<script lang="ts" module>
  export type BadgeVariant = 'neutral' | 'info' | 'success' | 'warning' | 'danger'
</script>

<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'

  type Props = {
    variant?: BadgeVariant
    size?: 'sm' | 'md'
    children?: Snippet
  } & Omit<HTMLAttributes<HTMLSpanElement>, 'children'>

  let { variant = 'neutral', size = 'md', class: className, children, ...rest }: Props = $props()

  const variants: Record<BadgeVariant, string> = {
    neutral: 'bg-raised text-text border-border',
    info: 'bg-info-bg text-info border-transparent',
    success: 'bg-success-bg text-success border-transparent',
    warning: 'bg-warning-bg text-warning border-transparent',
    danger: 'bg-danger-bg text-danger border-transparent'
  }
</script>

<span
  class={[
    'inline-flex items-center rounded-full border font-medium',
    size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-0.5 text-sm',
    variants[variant],
    className
  ]}
  {...rest}
>
  {@render children?.()}
</span>
