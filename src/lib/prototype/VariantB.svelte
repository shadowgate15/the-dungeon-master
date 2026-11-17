<!-- PROTOTYPE (throwaway) Variant B: visual-novel stage. Backdrop, big portrait, one textbox, log drawer. -->
<script lang="ts">
  import Composer from './Composer.svelte'
  import Controls from './Controls.svelte'
  import DebugPanel from './DebugPanel.svelte'
  import LogList from './LogList.svelte'
  import type { SceneStore } from './store.svelte.ts'

  let { store }: { store: SceneStore } = $props()
  const s = $derived(store.state)
  let drawer = $state(false)

  const backdrop = $derived(
    s.location.id === 'tavern'
      ? 'linear-gradient(160deg, #5a3a1e, #231a12 70%)'
      : 'linear-gradient(160deg, #3b4a52, #161c20 70%)'
  )
  const initials = (name: string) =>
    name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)

  /** What the textbox shows: the NPC's line in dialogue, otherwise the latest narration. */
  const beat = $derived.by(() => {
    if (s.mode === 'dialogue' && store.latestNpcLine) {
      return { who: store.latestNpcLine.npcName, text: `“${store.latestNpcLine.text}”` }
    }
    return { who: undefined, text: store.latestNarration?.text ?? '' }
  })
</script>

<div class="relative flex h-[calc(100dvh-3.5rem)] flex-col overflow-hidden text-white">
  <div
    class="absolute inset-0 transition-all"
    style:background={backdrop}
    style:filter={s.mode === 'dialogue' ? 'brightness(0.55)' : ''}
  ></div>

  <div class="relative z-10 flex items-start justify-between p-3">
    <div>
      <p class="font-display text-2xl drop-shadow">{s.location.name}</p>
      <p class="text-xs opacity-80">Exits: {s.location.exits.map((e) => e.label).join(', ')}</p>
    </div>
    <button
      type="button"
      class="rounded-control bg-black/40 px-3 py-1 text-sm"
      onclick={() => (drawer = !drawer)}>{drawer ? 'Close log' : 'Log'}</button
    >
  </div>

  <div class="relative z-10 flex flex-1 items-end justify-center gap-6 px-4">
    {#if s.mode === 'dialogue' && store.dialogueNpc}
      <div class="flex flex-col items-center">
        <div
          class="flex size-40 items-center justify-center rounded-full border-4 border-white/70 bg-primary font-display text-5xl shadow-overlay"
        >
          {initials(store.dialogueNpc.name)}
        </div>
        <p class="mt-2 font-display text-lg">{store.dialogueNpc.name}</p>
        <p class="text-xs opacity-80">{store.dialogueNpc.attitude}</p>
      </div>
    {:else}
      {#each s.npcsPresent as npc (npc.id)}
        <div class="flex flex-col items-center opacity-80">
          <div
            class="flex size-20 items-center justify-center rounded-full border-2 border-white/50 bg-black/40 font-display text-2xl"
          >
            {initials(npc.name)}
          </div>
          <p class="mt-1 text-xs">{npc.name}</p>
        </div>
      {/each}
    {/if}
  </div>

  <div class="relative z-10 space-y-2 p-3 pb-16">
    <div class="min-h-24 rounded-panel bg-black/60 p-4 backdrop-blur">
      {#if beat.who}<p class="font-display text-sm text-amber-300">{beat.who}</p>{/if}
      <p class="text-lg leading-relaxed">
        {beat.text}{#if store.thinking}<span class="animate-pulse opacity-70">
            {store.thinking}…</span
          >{/if}
      </p>
    </div>
    <div class="rounded-panel bg-surface p-2 text-text">
      <Composer {store} />
    </div>
  </div>

  {#if drawer}
    <aside
      class="absolute inset-y-0 right-0 z-20 flex w-full max-w-sm flex-col gap-3 overflow-y-auto bg-bg p-3 text-text shadow-overlay"
    >
      <Controls {store} />
      <LogList {store} class="min-h-48 flex-1" />
      <DebugPanel {store} />
    </aside>
  {/if}
</div>
