<script lang="ts" module>
  export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
  export type ButtonSize = 'sm' | 'md'
</script>

<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements'

  type Props = {
    variant?: ButtonVariant
    size?: ButtonSize
    href?: string
    children?: Snippet
  } & Omit<HTMLButtonAttributes, 'children'> &
    Omit<HTMLAnchorAttributes, 'children' | 'type'>

  let {
    variant = 'primary',
    size = 'md',
    href,
    class: className,
    children,
    ...rest
  }: Props = $props()

  const variants: Record<ButtonVariant, string> = {
    primary: 'bg-primary text-on-primary border-transparent hover:opacity-90',
    secondary: 'bg-raised text-text border-control-border hover:bg-surface',
    danger: 'bg-danger text-danger-bg border-transparent hover:opacity-90',
    ghost: 'bg-transparent text-text border-transparent hover:bg-raised'
  }
  const sizes: Record<ButtonSize, string> = {
    sm: 'px-2.5 py-1 text-sm',
    md: 'px-4 py-2 text-base'
  }
  const classes = $derived([
    'inline-flex items-center justify-center gap-2 rounded-control border font-medium no-underline',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
    'disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50',
    variants[variant],
    sizes[size],
    className
  ])
</script>

{#if href !== undefined}
  <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- callers pass resolved hrefs -->
  <a {href} class={classes} {...rest as HTMLAnchorAttributes}>
    {@render children?.()}
  </a>
{:else}
  <button class={classes} {...rest as HTMLButtonAttributes}>
    {@render children?.()}
  </button>
{/if}
