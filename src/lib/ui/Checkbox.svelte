<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements'

  type Props = {
    checked?: boolean
  } & Omit<HTMLInputAttributes, 'type' | 'checked'>

  let { checked = $bindable(false), class: className, ...rest }: Props = $props()
</script>

<input
  type="checkbox"
  bind:checked
  class={[
    'size-4 rounded-sm border border-control-border bg-raised text-primary',
    'focus:ring-0 focus:ring-offset-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
    'disabled:cursor-not-allowed disabled:opacity-50',
    className
  ]}
  {...rest}
/>
