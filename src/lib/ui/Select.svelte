<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { HTMLSelectAttributes } from 'svelte/elements'

  type Props = {
    value?: HTMLSelectAttributes['value']
    size?: 'sm' | 'md'
    /** Native `<option>` elements. */
    children?: Snippet
  } & Omit<HTMLSelectAttributes, 'size' | 'value' | 'children'>

  let { value = $bindable(), size = 'md', class: className, children, ...rest }: Props = $props()
</script>

<select
  bind:value
  class={[
    'block w-full rounded-control border border-control-border bg-raised text-text',
    'focus:border-control-border focus:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
    'disabled:cursor-not-allowed disabled:opacity-50',
    size === 'sm' ? 'py-1 pr-8 pl-2 text-sm' : 'py-2 pr-10 pl-3 text-base',
    className
  ]}
  {...rest}
>
  {@render children?.()}
</select>
