<!-- PROTOTYPE (throwaway): pending Proposal cards for one step. -->
<script lang="ts">
  import Button from '#lib/ui/Button.svelte'
  import ProposalCard from '#lib/ui/ProposalCard.svelte'
  import type { StepId, Wizard } from './model.svelte.ts'

  let { w, step, ids, title }: { w: Wizard; step: StepId; ids?: number[]; title?: string } =
    $props()
  const cards = $derived(ids ? w.proposals.filter((p) => ids.includes(p.id)) : w.pending(step))
</script>

{#if cards.length}
  <div class="space-y-2">
    {#if title}<p class="text-xs font-medium tracking-wide text-muted uppercase">{title}</p>{/if}
    {#each cards as p (p.id)}
      <ProposalCard label={p.label} value={p.value} status={p.status}>
        {#snippet actions()}
          {#if p.status === 'pending'}
            <Button size="sm" onclick={() => w.accept(p.id)}>Accept</Button>
            <Button size="sm" variant="secondary" onclick={() => w.dismiss(p.id)}>Dismiss</Button>
          {/if}
        {/snippet}
      </ProposalCard>
    {/each}
  </div>
{/if}
