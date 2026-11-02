<script lang="ts" module>
  export type BadgeVariant = 'neutral' | 'info' | 'success' | 'warning' | 'danger'
</script>

<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'
  import { NEUTRAL_CLASSES, STATUS_CLASSES_BORDERLESS } from './status.ts'

  type Props = {
    variant?: BadgeVariant
    size?: 'sm' | 'md'
    children?: Snippet
  } & Omit<HTMLAttributes<HTMLSpanElement>, 'children'>

  let { variant = 'neutral', size = 'md', class: className, children, ...rest }: Props = $props()

  const variants: Record<BadgeVariant, string> = {
    neutral: NEUTRAL_CLASSES,
    ...STATUS_CLASSES_BORDERLESS
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
