<script lang="ts">
  import type { RunStats, StepMessage } from './pipeline-events.ts'

  let { steps, stats }: { steps: StepMessage[]; stats: RunStats | null } = $props()
  const counts = $derived(
    stats ?? { steps: 0, directorCalls: 0, retries: 0, fallbacks: 0, capHits: 0 }
  )
</script>

<aside
  aria-label="Event inspector"
  class="space-y-4 overflow-y-auto rounded-panel border border-border bg-surface p-3 text-sm"
>
  <section aria-label="This run">
    <h2 class="text-xs font-semibold text-muted uppercase">This run</h2>
    <dl class="grid grid-cols-2 gap-x-2">
      <dt>Steps</dt>
      <dd>{counts.steps}</dd>
      <dt>Director calls</dt>
      <dd>{counts.directorCalls}</dd>
      <dt>Retries</dt>
      <dd>{counts.retries}</dd>
      <dt>Fallbacks</dt>
      <dd>{counts.fallbacks}</dd>
      <dt>Step cap hits</dt>
      <dd>{counts.capHits}</dd>
    </dl>
  </section>

  <section aria-label="Steps">
    <h2 class="text-xs font-semibold text-muted uppercase">Steps</h2>
    {#if steps.length === 0}
      <p class="text-muted">No run yet.</p>
    {:else}
      <ol class="space-y-2">
        {#each steps as s (s.step)}
          <li>
            <p>
              <span class="text-muted">{s.step}. {s.role}</span>
              <strong>{s.pick}</strong>
              {#if s.retried}<span class="text-warning"> retried</span>{/if}
              {#if s.fallback}<span class="text-danger"> fallback</span>{/if}
            </p>
            <p class="text-xs text-muted">menu: {s.menu.join(', ')}</p>
            <p class="text-xs text-muted">
              said: {s.raw.map((r) => JSON.stringify(r)).join(' then ')}
            </p>
          </li>
        {/each}
      </ol>
    {/if}
  </section>
</aside>
