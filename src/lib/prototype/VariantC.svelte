<!-- PROTOTYPE (throwaway) Variant C: three-column dashboard. Scene state | log | debug and event inspector. -->
<script lang="ts">
  import Composer from './Composer.svelte'
  import Controls from './Controls.svelte'
  import DebugPanel from './DebugPanel.svelte'
  import LogList from './LogList.svelte'
  import type { SceneStore } from './store.svelte.ts'

  let { store }: { store: SceneStore } = $props()
  const s = $derived(store.state)
</script>

<div
  class="grid h-[calc(100dvh-3.5rem)] grid-cols-1 gap-3 p-3 pb-16 lg:grid-cols-[18rem_1fr_22rem]"
>
  <aside
    class="space-y-3 overflow-y-auto rounded-panel border border-border bg-surface p-3 text-sm"
  >
    <div>
      <p class="text-xs font-semibold text-muted uppercase">Mode</p>
      <p
        class="inline-block rounded-full px-2 py-0.5 {s.mode === 'dialogue'
          ? 'bg-primary text-on-primary'
          : 'bg-info-bg text-info'}"
      >
        {s.mode}{store.dialogueNpc ? ` · ${store.dialogueNpc.name}` : ''}
      </p>
    </div>
    <div>
      <p class="text-xs font-semibold text-muted uppercase">Location</p>
      <p class="font-display text-lg">{s.location.name}</p>
      <p>{s.location.description}</p>
    </div>
    <div>
      <p class="text-xs font-semibold text-muted uppercase">Exits</p>
      <ul class="list-inside list-disc">
        {#each s.location.exits as e (e.id)}<li>{e.label}</li>{/each}
      </ul>
    </div>
    <div>
      <p class="text-xs font-semibold text-muted uppercase">Objects</p>
      <ul class="list-inside list-disc">
        {#each s.location.objects as o (o)}<li>{o}</li>{/each}
      </ul>
    </div>
    <div>
      <p class="text-xs font-semibold text-muted uppercase">Present</p>
      <ul class="space-y-2">
        {#each s.npcsPresent as npc (npc.id)}
          <li
            class="rounded-control border p-2 {npc.id === s.dialogueNpcId
              ? 'border-primary bg-raised'
              : 'border-border'}"
          >
            <p class="font-medium">{npc.name} <span class="text-muted">({npc.occupation})</span></p>
            <p class="text-xs">attitude: {npc.attitude}</p>
            <p class="text-xs text-muted">knows: {npc.knowledge}</p>
          </li>
        {/each}
      </ul>
    </div>
    <div>
      <p class="text-xs font-semibold text-muted uppercase">Pending roll</p>
      <p>
        {s.pendingRoll ? `${s.pendingRoll.check} DC ${s.pendingRoll.dc}` : 'none'}
      </p>
    </div>
  </aside>

  <main class="flex min-h-0 flex-col gap-3">
    <Controls {store} />
    <LogList {store} class="min-h-0 flex-1 rounded-panel border border-border bg-surface p-3" />
    <Composer {store} />
  </main>

  <aside class="overflow-y-auto rounded-panel border border-border bg-surface p-3">
    <DebugPanel {store} inspector />
  </aside>
</div>
