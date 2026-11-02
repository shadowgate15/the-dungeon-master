<script lang="ts">
  import Badge from '#lib/ui/Badge.svelte'
  import Meter from '#lib/ui/Meter.svelte'
  import { shouldCompact } from './context.ts'

  type Props = {
    used: number
    limit: number
    /** True when `used` is a character estimate rather than the provider's count. */
    estimated?: boolean
  }

  let { used, limit, estimated = false }: Props = $props()

  const warn = $derived(shouldCompact({ projected: used, limit }))
  const format = (n: number) => n.toLocaleString('en-US')
</script>

<div class="space-y-1 text-sm">
  <Meter label="Context" {used} {limit} {warn} />
  <p class="text-muted">
    {estimated ? '~' : ''}{format(used)} / {format(limit)} tokens
    {#if warn}
      <Badge variant="warning" size="sm"
        >Context almost full: older messages will be summarized.</Badge
      >
    {/if}
  </p>
</div>
