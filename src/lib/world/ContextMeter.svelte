<script lang="ts">
  import { contextMeter } from './context.ts'

  type Props = {
    used: number
    limit: number
    /** True when `used` is a character estimate rather than the provider's count. */
    estimated?: boolean
  }

  let { used, limit, estimated = false }: Props = $props()

  const meter = $derived(contextMeter({ used, limit }))
  const format = (n: number) => n.toLocaleString('en-US')
</script>

<div class="space-y-1 text-sm">
  <div
    role="meter"
    aria-label="Context"
    aria-valuemin="0"
    aria-valuemax={limit}
    aria-valuenow={used}
    class="h-2 overflow-hidden rounded bg-slate-200"
  >
    <div
      class={['h-full', meter.warn ? 'bg-amber-500' : 'bg-violet-500']}
      style:width="{meter.percent}%"
    ></div>
  </div>
  <p class="text-slate-600">
    {estimated ? '~' : ''}{format(used)} / {format(limit)} tokens
    {#if meter.warn}
      <span class="text-amber-700">· Context almost full: older messages will be summarized.</span>
    {/if}
  </p>
</div>
