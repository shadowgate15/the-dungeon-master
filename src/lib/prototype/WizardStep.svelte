<script lang="ts">
  // PROTOTYPE: the Character wizard at Bram's current step (a stored draft).
  import Button from '#lib/ui/Button.svelte'
  import { draft, wizardSteps } from './creation-mock.ts'
</script>

<div class="flex flex-col gap-3">
  <ol class="flex flex-wrap gap-1 text-xs">
    {#each wizardSteps as s, i (s)}
      <li
        class={[
          'rounded-full px-2 py-0.5',
          i === draft.step
            ? 'bg-primary text-on-primary'
            : i < draft.step
              ? 'bg-raised'
              : 'text-muted'
        ]}
      >
        {i + 1}. {s}
      </li>
    {/each}
  </ol>
  <h3 class="font-display text-lg">{draft.name} · {wizardSteps[draft.step]}</h3>
  {#each draft.fields as f (f.label)}
    <label class="flex flex-col gap-0.5 text-sm">
      <span class="flex items-center gap-2 font-medium">
        {f.label}
        {#if f.by === 'dm'}<span class="rounded bg-info-bg px-1 text-[10px] text-info">✎ DM</span
          >{/if}
      </span>
      <input
        value={f.value}
        placeholder="—"
        class="rounded-control border-control-border bg-raised py-1 text-sm"
      />
    </label>
  {/each}
  <div class="flex justify-between">
    <Button size="sm" variant="secondary">Back</Button>
    <span class="self-center text-xs text-muted">Draft saved to the Campaign</span>
    <Button size="sm">Next</Button>
  </div>
</div>
