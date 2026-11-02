<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'

  type Props = {
    /** Region name and visible heading. */
    title: string
    /** Heading level; pick the one that fits the page outline. */
    level?: 2 | 3 | 4
    children?: Snippet
  } & Omit<HTMLAttributes<HTMLElement>, 'children' | 'title'>

  let { title, level = 2, class: className, children, ...rest }: Props = $props()
</script>

<section
  aria-label={title}
  class={[
    'space-y-2 rounded-panel border border-border bg-surface p-4 text-text shadow-raised',
    className
  ]}
  {...rest}
>
  <svelte:element this={`h${level}`} class="font-display text-lg">{title}</svelte:element>
  {@render children?.()}
</section>
