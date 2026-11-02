<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { HTMLAnchorAttributes } from 'svelte/elements'

  type Props = {
    children?: Snippet
  } & Omit<HTMLAnchorAttributes, 'children'>

  let { class: className, children, ...rest }: Props = $props()
</script>

<a
  class={[
    'rounded-sm text-accent underline underline-offset-2 hover:no-underline',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
    className
  ]}
  {...rest}
>
  {@render children?.()}
</a>
