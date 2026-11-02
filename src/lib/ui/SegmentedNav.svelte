<script lang="ts" module>
  export type SegmentedNavItem = { href: string; label: string; current: boolean }
</script>

<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements'

  type Props = {
    /** Accessible name of the navigation. */
    label: string
    items: SegmentedNavItem[]
  } & Omit<HTMLAttributes<HTMLElement>, 'children'>

  let { label, items, class: className, ...rest }: Props = $props()
</script>

<nav
  aria-label={label}
  class={['inline-flex rounded-control border border-control-border', className]}
  {...rest}
>
  {#each items as item (item.href)}
    <!-- eslint-disable svelte/no-navigation-without-resolve -- callers pass resolved hrefs -->
    <a
      href={item.href}
      aria-current={item.current ? 'page' : undefined}
      class={[
        'px-3 py-1.5 text-sm font-medium no-underline first:rounded-l-[calc(var(--radius-control)-1px)] last:rounded-r-[calc(var(--radius-control)-1px)]',
        'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
        item.current ? 'bg-primary text-on-primary' : 'bg-raised text-text hover:bg-surface'
      ]}>{item.label}</a
    >
  {/each}
</nav>
