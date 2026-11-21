<script lang="ts">
  import type { MemoryInspector, MemoryRunSummary } from '#lib/memory/inspector.ts'
  import { EXCHANGE_STEPS, type RulingMessage, type RunStats } from './exchange-events.ts'

  let {
    ruling = null,
    stats,
    memory = null,
    onrefresh
  }: {
    /** How the latest Exchange was ruled; null before the first ruling. */
    ruling?: RulingMessage | null
    stats: RunStats | null
    /** Memory state from the page load; null hides the section. */
    memory?: MemoryInspector | null
    /** Reloads the page data (the Memory section is read via the load, never polled). */
    onrefresh?: () => void
  } = $props()
  const roles = $derived(Object.values(stats?.context?.roles ?? {}))
  const reasons = (r: MemoryRunSummary) => r.droppedItems.map((d) => `${d.kind}: ${d.reason}`)
  const requests = (step: (typeof EXCHANGE_STEPS)[number]) => stats?.steps[step]?.requests ?? 0
  /** The Adjudication's details beyond its outcome, as `key: value` pairs. */
  const details = (r: RulingMessage) =>
    Object.entries({ ...r.adjudication, ...(r.effect ?? {}) })
      .filter(([key]) => key !== 'outcome' && key !== 'effect')
      .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
</script>

<aside
  aria-label="Event inspector"
  class="space-y-4 overflow-y-auto rounded-panel border border-border bg-surface p-3 text-sm"
>
  <section aria-label="This Exchange">
    <h2 class="text-xs font-semibold text-muted uppercase">This Exchange</h2>
    <dl class="grid grid-cols-2 gap-x-2">
      {#each EXCHANGE_STEPS as step (step)}
        <dt>{step} requests</dt>
        <dd>{requests(step)}</dd>
      {/each}
    </dl>
  </section>

  <section aria-label="Ruling">
    <h2 class="text-xs font-semibold text-muted uppercase">Ruling</h2>
    {#if ruling}
      <p>Adjudication: <strong>{ruling.adjudication.outcome}</strong></p>
      <p>Effect: <strong>{ruling.effect?.effect ?? 'not applied'}</strong></p>
      {#each details(ruling) as detail (detail)}
        <p class="text-xs text-muted">{detail}</p>
      {/each}
    {:else}
      <p class="text-muted">No Exchange yet.</p>
    {/if}
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
</aside>
