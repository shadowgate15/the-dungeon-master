<script lang="ts">
  import Button from '#lib/ui/Button.svelte'
  import type { PendingPermission, PermissionBehavior } from './permission'

  /**
   * The permission prompt the DM's session is waiting on, inline above the composer (never a modal
   * or toast). The terminal's dialog stays open too; the first answer wins.
   */
  let {
    request,
    onanswer
  }: { request: PendingPermission; onanswer: (behavior: PermissionBehavior) => void } = $props()
</script>

<div
  role="group"
  aria-label="Permission request"
  class="flex shrink-0 flex-col gap-2 rounded-panel border-2 border-warning bg-warning-bg p-3 text-warning"
>
  <p class="text-sm font-semibold">Behind the screen: the DM asks permission</p>
  {#if request.description}<p class="text-sm">{request.description}</p>{/if}
  <code class="rounded bg-black/10 px-2 py-1 text-xs break-all"
    >{request.toolName}{#if request.inputPreview}: {request.inputPreview}{/if}</code
  >
  <div class="flex gap-2">
    <Button size="sm" onclick={() => onanswer('allow')}>Allow</Button>
    <Button size="sm" variant="secondary" onclick={() => onanswer('deny')}>Deny</Button>
  </div>
</div>
