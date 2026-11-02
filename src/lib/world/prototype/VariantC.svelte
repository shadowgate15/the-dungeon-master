<script lang="ts">
  // PROTOTYPE variant C: a library of cards. Creation is the hero at the top (collapses once
  // you have Worlds); archiving moves a card onto a "shelf" below instead of hiding it
  // on another page. Card actions are discoverable, no hidden routes.
  import type { Snippet } from 'svelte'
  import { resolve } from '$app/paths'
  import { ago, type ProtoWorld, type createProtoStore } from './store.svelte.ts'
  import Toast from './Toast.svelte'

  let { store, create }: { store: ReturnType<typeof createProtoStore>; create: Snippet } = $props()

  // Opens on its own when there is nothing to manage yet.
  let creating = $state(false)
  let shelfOpen = $state(false)
  let confirming = $state<string | null>(null)
  let refusedId = $state<string | null>(null)
  const showCreate = $derived(creating || store.worlds.length === 0)

  const accents: Record<string, string> = {
    'high fantasy': 'from-sky-400 to-indigo-500',
    'dark fantasy': 'from-slate-600 to-purple-900',
    'sword and sorcery': 'from-orange-400 to-red-600',
    mythic: 'from-amber-300 to-yellow-600',
    'gothic horror': 'from-zinc-500 to-rose-900',
    'science fantasy': 'from-fuchsia-400 to-cyan-500',
    'science fiction': 'from-cyan-400 to-blue-700',
    'post-apocalyptic': 'from-lime-600 to-stone-700'
  }
  const accent = (w: ProtoWorld) => accents[w.genreFlavor ?? ''] ?? 'from-slate-300 to-slate-500'
  const chips = (w: ProtoWorld) =>
    [w.scale, w.magicLevel && `${w.magicLevel} magic`, w.techLevel].filter(Boolean) as string[]

  function del(w: ProtoWorld) {
    if (!store.remove(w.id)) refusedId = w.id
    confirming = null
  }
</script>

<main class="min-h-screen bg-stone-100 p-6 pb-24 text-slate-900">
  <div class="mx-auto max-w-6xl space-y-8">
    <header class="flex items-end justify-between">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">Your Worlds</h1>
        <p class="text-sm text-slate-500">
          {store.active.length} active{store.archived.length
            ? `, ${store.archived.length} on the shelf`
            : ''}
        </p>
      </div>
      {#if store.seeded}<span class="rounded bg-amber-100 px-2 py-1 text-xs">Sample data</span>{/if}
    </header>

    <section class="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5">
      <button
        type="button"
        class="flex w-full items-center justify-between bg-gradient-to-r from-amber-100 to-orange-100 p-5 text-left"
        onclick={() => (creating = !creating)}
        aria-expanded={showCreate}
      >
        <span>
          <span class="block text-lg font-semibold">Begin a new World</span>
          <span class="block text-sm text-slate-600"
            >Talk it through with the AI, or fill the seed card by hand.</span
          >
        </span>
        <span class="text-2xl">{showCreate ? '−' : '+'}</span>
      </button>
      {#if showCreate}
        <div class="p-5">{@render create()}</div>
      {/if}
    </section>

    <ul aria-label="Worlds" class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {#each store.active as w (w.id)}
        <li
          class="group flex flex-col overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5"
        >
          <div
            class="h-20 bg-gradient-to-br {accent(
              w
            )} p-3 text-xs font-medium text-white/90 uppercase"
          >
            {w.genreFlavor ?? 'unspecified genre'}
          </div>
          <div class="flex-1 space-y-2 p-4">
            <a
              href={resolve('/worlds/[id]/edit', { id: w.id })}
              class="text-lg font-semibold hover:underline">{w.name}</a
            >
            <p class="line-clamp-3 text-sm text-slate-600">{w.premise}</p>
            <div class="flex flex-wrap gap-1">
              {#each chips(w) as chip (chip)}
                <span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{chip}</span>
              {/each}
            </div>
          </div>
          <div class="space-y-2 border-t px-4 py-3 text-sm">
            <div class="flex items-center justify-between text-xs text-slate-500">
              <span>{w.campaigns} {w.campaigns === 1 ? 'Campaign' : 'Campaigns'}</span>
              <span>updated {ago(w.updatedAt)}</span>
            </div>
            {#if confirming === w.id}
              <div class="flex items-center gap-2">
                <span class="mr-auto text-xs">Delete forever?</span>
                <button
                  type="button"
                  class="rounded bg-red-700 px-2 py-1 text-white"
                  onclick={() => del(w)}>Delete</button
                >
                <button type="button" onclick={() => (confirming = null)}>Keep</button>
              </div>
            {:else}
              <div class="flex gap-2">
                <a
                  href={resolve('/worlds/[id]/edit', { id: w.id })}
                  class="rounded border px-2 py-1">Edit</a
                >
                <button
                  type="button"
                  class="rounded border px-2 py-1"
                  onclick={() => store.archive([w.id])}>Archive</button
                >
                <button
                  type="button"
                  class="ml-auto px-2 py-1 text-slate-400 hover:text-red-700"
                  onclick={() => ((confirming = w.id), (refusedId = null))}>Delete</button
                >
              </div>
            {/if}
            {#if refusedId === w.id}
              <p role="alert" class="text-xs text-red-600">
                A Campaign uses this World. Archive it instead.
              </p>
            {/if}
          </div>
        </li>
      {:else}
        <li class="col-span-full rounded-xl border-2 border-dashed p-10 text-center text-slate-500">
          Nothing here yet. Begin a World above.
        </li>
      {/each}
    </ul>

    {#if store.archived.length > 0}
      <section class="space-y-3 rounded-xl bg-stone-200/70 p-4">
        <button
          type="button"
          class="flex w-full items-center justify-between text-left font-medium"
          aria-expanded={shelfOpen}
          onclick={() => (shelfOpen = !shelfOpen)}
        >
          <span>Shelf · {store.archived.length} archived</span>
          <span>{shelfOpen ? '▾' : '▸'}</span>
        </button>
        {#if shelfOpen}
          <ul class="space-y-2">
            {#each store.archived as w (w.id)}
              <li class="flex items-center gap-3 rounded bg-white/70 px-3 py-2 text-sm">
                <a
                  href={resolve('/worlds/[id]/edit', { id: w.id })}
                  class="mr-auto font-medium underline">{w.name}</a
                >
                <span class="text-xs text-slate-500">archived {ago(w.archivedAt ?? 0)}</span>
                <button
                  type="button"
                  class="rounded border px-2 py-1"
                  onclick={() => store.restore([w.id])}>Restore</button
                >
                <button
                  type="button"
                  class="text-slate-400 hover:text-red-700"
                  onclick={() => del(w)}>Delete</button
                >
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    {/if}
  </div>
</main>

<Toast toast={store.toast} ondismiss={store.dismissToast} />
