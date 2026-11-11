<script lang="ts">
  import Button from '#lib/ui/Button.svelte'
  import type { RollRequest } from './enums.ts'
  import { checkLabel } from './roll.ts'

  /**
   * The pending Roll request, shown in place of the text input: the check, the DC and the DM's
   * reason, and a Roll button. Clicking asks the server to roll; the player cannot skip it.
   */
  type Props = {
    request: RollRequest
    /** Disabled while the roll is being made. */
    busy?: boolean
    onroll: () => void
  }

  let { request, busy = false, onroll }: Props = $props()
</script>

<section aria-label="Roll request" class="space-y-2 px-2 py-1">
  <p class="font-display text-lg">{checkLabel(request)}, DC {request.dc}</p>
  <p class="text-sm text-muted">{request.reason}</p>
  <div class="flex justify-end">
    <Button size="sm" disabled={busy} onclick={onroll}>Roll d20</Button>
  </div>
</section>
