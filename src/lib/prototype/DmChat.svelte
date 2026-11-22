<script lang="ts">
  // PROTOTYPE: DM conversation pane for creation (out of fiction, not logged).
  import Button from '#lib/ui/Button.svelte'
  import { chat } from './creation-mock.ts'
  let { live, class: cls = '' }: { live: boolean; class?: string } = $props()
</script>

<div class={['flex flex-col rounded-panel border border-border bg-surface', cls]}>
  <div class="flex items-center justify-between border-b border-border px-3 py-2">
    <h2 class="font-display">Talk to the DM</h2>
    <span class={['text-xs', live ? 'text-success' : 'text-muted']}
      >{live ? '● session live' : '○ no session'}</span
    >
  </div>
  {#if live}
    <div class="flex flex-1 flex-col gap-2 overflow-y-auto p-3 text-sm">
      {#each chat as m, i (i)}
        {#if m.who === 'tool'}
          <p class="text-center font-mono text-[11px] text-muted">✎ DM {m.text}</p>
        {:else}
          <p
            class={[
              'max-w-[85%] rounded-control px-3 py-2',
              m.who === 'player' ? 'self-end bg-primary/10' : 'bg-raised'
            ]}
          >
            {m.text}
          </p>
        {/if}
      {/each}
    </div>
    <div class="flex gap-2 border-t border-border p-2">
      <input
        class="flex-1 rounded-control border-control-border bg-raised text-sm"
        placeholder="Ask the DM for help…"
      />
      <Button size="sm">Send</Button>
    </div>
  {:else}
    <div
      class="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted"
    >
      <p>The forms work without the DM.</p>
      <p>
        To get help filling them in, run <code class="rounded bg-raised px-1">dm</code> in this Campaign’s
        folder.
      </p>
    </div>
  {/if}
</div>
