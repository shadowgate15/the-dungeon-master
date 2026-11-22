<script lang="ts">
  // PROTOTYPE: one roll, as the Player sees it (no enemy AC/DC, both dice on advantage).
  import type { DiceEntry } from './play-mock.ts'
  let { d, compact = false }: { d: DiceEntry; compact?: boolean } = $props()
</script>

<div class={['flex flex-wrap items-baseline gap-x-2 text-sm', compact && 'text-xs']}>
  <span class="font-medium">{d.who}</span>
  <span class="text-muted">{d.what}</span>
  <span class="font-mono text-xs text-muted">{d.dice}</span>
  <span class="font-mono font-semibold">= {d.total}</span>
  {#if d.outcome}<span class="text-accent">{d.outcome}</span>{/if}
  {#if d.note}<span class="text-xs text-muted italic">({d.note})</span>{/if}
</div>
