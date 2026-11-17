<script lang="ts">
  import type { PendingRoll } from './enums.ts'
  import Button from '#lib/ui/Button.svelte'

  type Props = {
    roll: PendingRoll
    /** True while the roll is being resolved. */
    busy?: boolean
    onroll: () => void
  }

  let { roll, busy = false, onroll }: Props = $props()
</script>

<!-- An overlay on any mode, never a mode. It is rendered from the pending roll in the database,
     so it comes back after a reload, and there is no way to dismiss it but to roll. -->
<div
  class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
  role="alertdialog"
  aria-modal="true"
  aria-labelledby="roll-title"
  aria-describedby="roll-reason"
>
  <div
    class="w-full max-w-sm space-y-3 rounded-panel border border-border bg-surface p-5 text-center shadow-raised"
  >
    <h2 id="roll-title" class="font-display text-xl capitalize">{roll.check} check</h2>
    <p class="text-3xl font-semibold">DC {roll.dc}</p>
    <p id="roll-reason" class="text-sm text-muted">{roll.reason}</p>
    <Button type="button" onclick={onroll} disabled={busy}>Roll d20</Button>
  </div>
</div>
