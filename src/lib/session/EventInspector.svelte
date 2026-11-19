<script lang="ts">
  import type { MemoryInspector, MemoryRunSummary } from '#lib/memory/inspector.ts'
  import type { RunStats, StepMessage } from './pipeline-events.ts'

  let {
    steps,
    stats,
    memory = null,
    onrefresh
  }: {
    steps: StepMessage[]
    stats: RunStats | null
    /** Memory state from the page load; null hides the section. */
    memory?: MemoryInspector | null
    /** Reloads the page data (the Memory section is read via the load, never polled). */
    onrefresh?: () => void
  } = $props()
  const roles = $derived(Object.values(stats?.context?.roles ?? {}))
  const reasons = (r: MemoryRunSummary) => r.droppedItems.map((d) => `${d.kind}: ${d.reason}`)
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

  {#snippet runLine(r: MemoryRunSummary)}
    <p>
      {r.kind}
      <span class={r.outcome === 'failure' ? 'text-danger' : ''}>{r.outcome}</span>
      <span class="text-xs text-muted">
        seq {r.fromSeq}-{r.toSeq}, {r.durationMs} ms
      </span>
    </p>
    <p class="text-xs text-muted">{r.accepted} accepted, {r.dropped} dropped</p>
    {#each reasons(r) as reason, i (i)}
      <p class="text-xs text-muted">{reason}</p>
    {/each}
  {/snippet}

  {#if memory}
    <section aria-label="Memory" class="space-y-2">
      <div class="flex items-center justify-between">
        <h2 class="text-xs font-semibold text-muted uppercase">Memory</h2>
        <button type="button" class="text-xs underline" onclick={() => onrefresh?.()}
          >Refresh memory</button
        >
      </div>
      <p>
        {#if memory.paused}<strong class="text-danger">Extraction paused</strong>{/if}
        {#if memory.extractionRunning}<span class="text-warning">Extraction running</span>{/if}
        {#if memory.summaryRunning}<span class="text-warning">Summary running</span>{/if}
      </p>
      <p>Watermark lag: {memory.lag} events</p>
      <p class="text-xs text-muted">
        watermark {memory.watermark} of {memory.latestSeq}, summary through {memory.summaryThroughSeq}
      </p>
      <div>
        <h3 class="text-xs text-muted">Last extraction</h3>
        {#if memory.lastExtraction}
          {@render runLine(memory.lastExtraction)}
        {:else}
          <p class="text-muted">None yet.</p>
        {/if}
      </div>
      <div>
        <h3 class="text-xs text-muted">Last summary</h3>
        {#if memory.lastSummary}
          {@render runLine(memory.lastSummary)}
        {:else}
          <p class="text-muted">None yet.</p>
        {/if}
      </div>
      <div>
        <h3 class="text-xs text-muted">Recent memory runs</h3>
        {#if memory.recent.length === 0}
          <p class="text-muted">None yet.</p>
        {:else}
          <ul class="space-y-1">
            {#each memory.recent as r (r.id)}
              <li>{@render runLine(r)}</li>
            {/each}
          </ul>
        {/if}
      </div>
      <div>
        <h3 class="text-xs text-muted">Context</h3>
        {#if roles.length === 0}
          <p class="text-muted">No run yet.</p>
        {:else}
          <ul>
            {#each roles as c (c.role)}
              <li>
                <p>{c.role}: {c.used} / {c.cap} tokens</p>
                <p class="text-xs text-muted">
                  memory {c.memoryUsed} / {c.memoryBudget}, {c.verbatim} verbatim, {c.summarised}
                  summarised, trims {c.trims.memory}/{c.trims.events}/{c.trims.summary}
                </p>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </section>
  {/if}

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
