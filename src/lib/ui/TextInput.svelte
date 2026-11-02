<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements'

  type Props = {
    value?: HTMLInputAttributes['value']
    size?: 'sm' | 'md'
  } & Omit<HTMLInputAttributes, 'size' | 'value'>

  let { value = $bindable(), size = 'md', class: className, ...rest }: Props = $props()
</script>

<input
  bind:value
  class={[
    'block w-full rounded-control border border-control-border bg-raised text-text placeholder:text-muted',
    'focus:border-control-border focus:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
    'disabled:cursor-not-allowed disabled:opacity-50',
    size === 'sm' ? 'px-2 py-1 text-sm' : 'px-3 py-2 text-base',
    className
  ]}
  {...rest}
/>
