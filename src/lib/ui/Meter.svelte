<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements'

  type Props = {
    /** Accessible name of the meter. */
    label: string
    used: number
    limit: number
    /** Caller decides when the meter turns to the warning colour. */
    warn?: boolean
  } & Omit<HTMLAttributes<HTMLDivElement>, 'children'>

  let { label, used, limit, warn = false, class: className, ...rest }: Props = $props()

  const value = $derived(Math.min(Math.max(used, 0), Math.max(limit, 0)))
  const percent = $derived(limit > 0 ? (value / limit) * 100 : 0)
</script>

<div
  role="meter"
  aria-label={label}
  aria-valuemin="0"
  aria-valuemax={limit}
  aria-valuenow={value}
  class={['h-2 overflow-hidden rounded-full bg-border', className]}
  {...rest}
>
  <div class={['h-full', warn ? 'bg-warning' : 'bg-primary']} style:width="{percent}%"></div>
</div>
