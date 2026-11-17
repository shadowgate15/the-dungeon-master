<!-- PROTOTYPE (throwaway) Variant A: location hero + NPC strip + story log. Dialogue foregrounds the NPC. -->
<script lang="ts">
  import Composer from './Composer.svelte'
  import Controls from './Controls.svelte'
  import DebugPanel from './DebugPanel.svelte'
  import LogList from './LogList.svelte'
  import type { SceneStore } from './store.svelte.ts'

  let { store }: { store: SceneStore } = $props()
  const s = $derived(store.state)
</script>

<div class="mx-auto flex h-[calc(100dvh-3.5rem)] max-w-3xl flex-col gap-3 p-4 pb-16">
  <Controls {store} />

  {#if s.mode === 'dialogue' && store.dialogueNpc}
    {@const npc = store.dialogueNpc}
    <p class="text-xs text-muted">📍 {s.location.name}</p>
    <section class="rounded-panel border border-primary bg-raised p-4 shadow-raised">
      <p class="font-display text-xl">{npc.name}</p>
      <p class="text-sm text-muted">{npc.occupation} · {npc.attitude}</p>
      <p class="mt-2 min-h-12 text-lg">
        {#if store.latestNpcLine}“{store.latestNpcLine.text}”{:else}…{/if}
      </p>
    </section>
    <div class="flex gap-2 opacity-60">
      {#each s.npcsPresent.filter((n) => n.id !== npc.id) as other (other.id)}
        <span class="rounded-full border border-border px-2 py-0.5 text-xs">{other.name}</span>
      {/each}
    </div>
  {:else}
    <section class="rounded-panel bg-raised p-4 shadow-raised">
      <h2 class="font-display text-2xl">{s.location.name}</h2>
      <p class="mt-1">{s.location.description}</p>
      <p class="mt-2 text-sm text-muted">
        Exits: {s.location.exits.map((e) => e.label).join(', ')} · Here: {s.location.objects.join(
          ', '
        )}
      </p>
    </section>
    <div class="flex flex-wrap gap-2">
      {#each s.npcsPresent as npc (npc.id)}
        <div class="rounded-panel border border-border bg-surface px-3 py-1.5 text-sm">
          <span class="font-medium">{npc.name}</span>
          <span class="text-muted"> · {npc.occupation} · {npc.attitude}</span>
        </div>
      {:else}
        <span class="text-sm text-muted">Nobody else is here.</span>
      {/each}
    </div>
  {/if}

  <LogList {store} class="min-h-0 flex-1 rounded-panel border border-border bg-surface p-3" />
  <Composer {store} />
  <details class="rounded-control border border-border p-2">
    <summary class="cursor-pointer text-xs font-semibold uppercase">Debug</summary>
    <DebugPanel {store} />
  </details>
</div>
