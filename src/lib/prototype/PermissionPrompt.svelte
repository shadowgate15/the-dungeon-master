<script lang="ts">
  // PROTOTYPE: a permission prompt relayed from the Claude Code session (claude/channel/permission).
  import Button from '#lib/ui/Button.svelte'
  import { permission } from './play-mock.ts'
  let { onanswer }: { onanswer: () => void } = $props()
</script>

<div
  role="alertdialog"
  aria-label="Permission request"
  class="flex flex-col gap-2 rounded-panel border-2 border-warning bg-warning-bg p-3 text-warning"
>
  <p class="text-sm font-semibold">Behind the screen: the DM asks permission</p>
  <p class="text-sm">{permission.why}</p>
  <code class="rounded bg-black/10 px-2 py-1 text-xs">{permission.tool}: {permission.detail}</code>
  <div class="flex gap-2">
    <Button size="sm" onclick={onanswer}>Allow</Button>
    <Button size="sm" variant="secondary" onclick={onanswer}>Deny</Button>
  </div>
</div>
