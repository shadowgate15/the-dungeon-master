<script lang="ts">
  // PROTOTYPE: an open Call attached to a Narration — one button group per Character named.
  import Button from '#lib/ui/Button.svelte'
  import { openCall } from './play-mock.ts'
  let { onresolve }: { onresolve: () => void } = $props()
</script>

<div class="rounded-panel border-2 border-primary bg-raised p-3">
  <p class="mb-2 text-sm">{openCall.prompt}</p>
  {#each openCall.rolls as r (r.who)}
    <div class="flex flex-wrap items-center gap-2">
      <span class="font-medium">{r.who}</span>
      <span class="text-sm text-muted">{r.label}</span>
      {#each r.options as o, i (o)}
        <Button size="sm" variant={i === 0 ? 'primary' : 'secondary'} onclick={onresolve}
          >{i === 0 ? '🎲 ' : ''}{o}</Button
        >
      {/each}
    </div>
  {/each}
</div>
