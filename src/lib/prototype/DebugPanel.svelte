<!-- PROTOTYPE (throwaway): run stats, director traces, event inspector and full state. -->
<script lang="ts">
  import type { SceneStore } from './store.svelte.ts'

  let { store, inspector = false }: { store: SceneStore; inspector?: boolean } = $props()
</script>

<div class="space-y-3 text-xs">
  <section>
    <h3 class="font-semibold uppercase">This run</h3>
    {#if store.stats}
      <p>
        steps {store.stats.steps}/{store.stepCap} · director calls {store.stats.directorCalls} · retries
        {store.stats.retries} · fallbacks {store.stats.fallbacks} · cap hits {store.stats.capHits}
      </p>
    {:else}
      <p class="text-muted">no run yet</p>
    {/if}
  </section>

  <section>
    <h3 class="font-semibold uppercase">Director picks</h3>
    <ol class="space-y-1">
      {#each store.traces as t (t.step)}
        <li class="rounded-control bg-surface p-1.5">
          <span class="font-mono font-semibold">{t.step}. {t.pick}</span>
          {#if t.retried}<span class="text-warning"> · retried</span>{/if}
          {#if t.fallback}<span class="text-danger"> · fallback</span>{/if}
          <div class="text-muted">
            raw: {t.raw.map((r) => JSON.stringify(r ?? null)).join(' → ')}
          </div>
          <div class="text-muted">menu: {t.menu.join(', ')}</div>
        </li>
      {/each}
    </ol>
  </section>

  <section>
    <h3 class="font-semibold uppercase">Run history (cumulative)</h3>
    <ul>
      {#each store.runs as r, i (i)}
        <li>
          {r.reason} · steps {r.stats.steps} · retries {r.stats.retries} · fallbacks {r.stats
            .fallbacks} · cap {r.stats.capHits}
        </li>
      {/each}
    </ul>
  </section>

  {#if inspector}
    <section>
      <h3 class="font-semibold uppercase">Event log (by role)</h3>
      <ol class="space-y-0.5">
        {#each store.state.log as e (e.id)}
          <li class="font-mono">#{e.seq} {e.role}/{e.kind}{e.npcName ? ` (${e.npcName})` : ''}</li>
        {/each}
      </ol>
    </section>
  {/if}

  <details>
    <summary class="cursor-pointer font-semibold uppercase">Full state</summary>
    <pre class="max-h-96 overflow-auto rounded-control bg-surface p-2">{JSON.stringify(
        { ...store.state, log: `${store.state.log.length} events` },
        null,
        2
      )}</pre>
  </details>
</div>
