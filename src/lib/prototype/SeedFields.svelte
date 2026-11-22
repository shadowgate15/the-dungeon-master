<script lang="ts">
  // PROTOTYPE: Seed card fields; fields the DM set carry a marker.
  import { seed } from './creation-mock.ts'
  let { dense = false }: { dense?: boolean } = $props()
</script>

<div class={['flex flex-col', dense ? 'gap-1.5' : 'gap-3']}>
  {#each seed as f (f.key)}
    <label class="flex flex-col gap-0.5 text-sm">
      <span class="flex items-center gap-2 font-medium">
        {f.label}
        {#if f.by === 'dm'}<span class="rounded bg-info-bg px-1 text-[10px] text-info">✎ DM</span
          >{/if}
      </span>
      {#if f.key === 'premise' && !dense}
        <textarea rows="3" class="rounded-control border-control-border bg-raised text-sm"
          >{f.value}</textarea
        >
      {:else}
        <input
          value={f.value}
          placeholder="—"
          class="rounded-control border-control-border bg-raised py-1 text-sm"
        />
      {/if}
    </label>
  {/each}
</div>
