<!-- PROTOTYPE (issue #74): fake creation conversation with one Proposal card. -->
<script lang="ts">
  import { world } from './proto-store.svelte.ts'

  let { worldIds, onaccept }: { worldIds: string[]; onaccept: (field: string, value: string) => void } =
    $props()
  let proposal = $state<{ field: string; value: string } | null>({
    field: 'premise',
    value: 'A river-port festival hides a cult that feeds on the city’s bells.'
  })
</script>

<div class="space-y-2 rounded border bg-slate-50 p-3 text-sm">
  <p class="text-xs text-slate-500">
    The AI sees the Seeds of: {worldIds.map((id) => world(id).name).join(', ') || 'no Worlds yet'}
  </p>
  <p class="rounded bg-white p-2">Tell me what kind of Campaign you want to run.</p>
  <p class="ml-8 rounded bg-slate-800 p-2 text-white">Something spooky around a festival.</p>
  {#if proposal}
    <div class="rounded border-2 border-amber-400 bg-white p-2">
      <p class="text-xs font-medium uppercase text-amber-700">Proposal: {proposal.field}</p>
      <p>{proposal.value}</p>
      <div class="mt-2 flex gap-2">
        <button
          type="button"
          class="rounded bg-slate-800 px-2 py-1 text-white"
          onclick={() => {
            onaccept(proposal!.field, proposal!.value)
            proposal = null
          }}>Accept</button
        >
        <button type="button" class="px-2 py-1" onclick={() => (proposal = null)}>Dismiss</button>
      </div>
    </div>
  {/if}
  <input class="w-full rounded border p-2" placeholder="Message the AI…" />
</div>
