<script lang="ts">
  // PROTOTYPE variant A: master-detail. One screen: list on the left, the selected World
  // on the right with inline edit and lifecycle actions. Creating swaps the right pane.
  import type { Snippet } from 'svelte'
  import { resolve } from '$app/paths'
  import { GENRE_FLAVORS, MAGIC_LEVELS, SCALES, TECH_LEVELS } from '#lib/world/enums.ts'
  import { ago, type createProtoStore } from './store.svelte.ts'
  import Toast from './Toast.svelte'

  let { store, create }: { store: ReturnType<typeof createProtoStore>; create: Snippet } = $props()

  let tab = $state<'active' | 'archived'>('active')
  let query = $state('')
  let selectedId = $state<string | null>(null)
  let creating = $state(false)
  let confirmingDelete = $state(false)
  let refused = $state(false)

  const list = $derived(
    (tab === 'active' ? store.active : store.archived).filter((w) =>
      w.name.toLowerCase().includes(query.toLowerCase())
    )
  )
  const selected = $derived(list.find((w) => w.id === selectedId) ?? list[0] ?? null)

  const pickers = [
    ['genreFlavor', 'Genre flavor', GENRE_FLAVORS],
    ['scale', 'Scale', SCALES],
    ['magicLevel', 'Magic level', MAGIC_LEVELS],
    ['techLevel', 'Tech level', TECH_LEVELS]
  ] as const

  // Draft of the selected World; dirty state drives the Save / Revert bar.
  let draft = $state<Record<string, string>>({})
  $effect(() => {
    if (!selected) return
    draft = {
      name: selected.name,
      premise: selected.premise ?? '',
      genreFlavor: selected.genreFlavor ?? '',
      scale: selected.scale ?? '',
      magicLevel: selected.magicLevel ?? '',
      techLevel: selected.techLevel ?? ''
    }
    confirmingDelete = false
    refused = false
  })
  const dirty = $derived(
    !!selected &&
      (draft.name !== selected.name ||
        draft.premise !== (selected.premise ?? '') ||
        pickers.some(([k]) => draft[k] !== ((selected as Record<string, unknown>)[k] ?? '')))
  )
</script>

<div class="flex h-screen bg-slate-50 text-slate-900">
  <aside class="flex w-80 shrink-0 flex-col border-r bg-white">
    <div class="space-y-3 border-b p-4">
      <div class="flex items-center justify-between">
        <h1 class="text-lg font-semibold">Worlds</h1>
        <button
          type="button"
          class="rounded bg-slate-800 px-3 py-1 text-sm text-white"
          onclick={() => (creating = true)}>+ New World</button
        >
      </div>
      <input
        type="search"
        placeholder="Search Worlds"
        bind:value={query}
        class="w-full rounded border p-2 text-sm"
      />
      <div class="grid grid-cols-2 rounded bg-slate-100 p-0.5 text-sm" role="tablist">
        {#each [['active', `Active (${store.active.length})`], ['archived', `Archived (${store.archived.length})`]] as const as [key, label] (key)}
          <button
            type="button"
            role="tab"
            aria-selected={tab === key}
            class="rounded px-2 py-1 {tab === key
              ? 'bg-white font-medium shadow-sm'
              : 'text-slate-500'}"
            onclick={() => ((tab = key), (creating = false))}>{label}</button
          >
        {/each}
      </div>
    </div>
    <ul class="flex-1 overflow-y-auto">
      {#each list as w (w.id)}
        <li>
          <button
            type="button"
            class="w-full border-b px-4 py-3 text-left hover:bg-slate-50 {selected?.id === w.id &&
            !creating
              ? 'bg-amber-50'
              : ''}"
            onclick={() => ((selectedId = w.id), (creating = false))}
          >
            <span class="block font-medium">{w.name}</span>
            <span class="block truncate text-xs text-slate-500">
              {[w.genreFlavor, w.scale].filter(Boolean).join(' · ') || 'No seed attributes'}
            </span>
          </button>
        </li>
      {:else}
        <li class="p-4 text-sm text-slate-500">
          {tab === 'archived' ? 'Nothing archived.' : 'No Worlds match.'}
        </li>
      {/each}
    </ul>
    {#if store.seeded}
      <p class="border-t bg-amber-100 p-2 text-xs">Sample data: database has no Worlds.</p>
    {/if}
  </aside>

  <section class="flex-1 overflow-y-auto p-8">
    {#if creating}
      <div class="mx-auto max-w-xl space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-xl font-semibold">New World</h2>
          <button type="button" class="text-sm underline" onclick={() => (creating = false)}
            >Cancel</button
          >
        </div>
        {@render create()}
      </div>
    {:else if selected}
      {@const archived = selected.archivedAt !== null}
      <div class="mx-auto max-w-2xl space-y-6">
        <header class="flex items-start justify-between gap-4">
          <div>
            <h2 class="text-2xl font-semibold">{selected.name}</h2>
            <p class="text-sm text-slate-500">
              Updated {ago(selected.updatedAt)} · used by {selected.campaigns}
              {selected.campaigns === 1 ? 'Campaign' : 'Campaigns'}
              {#if archived}· <span class="text-amber-700">archived</span>{/if}
            </p>
          </div>
          <div class="flex gap-2">
            <a
              href={resolve('/worlds/[id]/edit', { id: selected.id })}
              class="rounded border px-3 py-1 text-sm">Full editor</a
            >
            {#if archived}
              <button
                type="button"
                class="rounded border px-3 py-1 text-sm"
                onclick={() => store.restore([selected.id])}>Restore</button
              >
            {:else}
              <button
                type="button"
                class="rounded border px-3 py-1 text-sm"
                onclick={() => store.archive([selected.id])}>Archive</button
              >
            {/if}
          </div>
        </header>

        {#if archived}
          <p class="rounded border border-amber-400 bg-amber-50 p-3 text-sm">
            Archived and read-only. Restore to edit.
          </p>
        {/if}

        <fieldset disabled={archived} class="space-y-3">
          <label class="block">
            <span class="text-sm font-medium">Name</span>
            <input bind:value={draft.name} class="w-full rounded border bg-white p-2" />
          </label>
          <label class="block">
            <span class="text-sm font-medium">Premise</span>
            <textarea bind:value={draft.premise} rows="4" class="w-full rounded border bg-white p-2"
            ></textarea>
          </label>
          <div class="grid grid-cols-2 gap-3">
            {#each pickers as [key, label, options] (key)}
              <label class="block">
                <span class="text-sm font-medium">{label}</span>
                <select bind:value={draft[key]} class="w-full rounded border bg-white p-2">
                  <option value="">Unspecified</option>
                  {#each options as o (o)}<option value={o}>{o}</option>{/each}
                </select>
              </label>
            {/each}
          </div>
        </fieldset>

        {#if dirty}
          <div
            class="sticky bottom-4 flex items-center justify-between rounded bg-slate-900 p-3 text-white shadow-lg"
          >
            <span class="text-sm"
              >Unsaved changes. Edits apply live to {selected.campaigns} Campaigns.</span
            >
            <span class="flex gap-2">
              <button
                type="button"
                class="rounded border border-slate-500 px-3 py-1 text-sm"
                onclick={() =>
                  (draft = { ...draft, name: selected.name, premise: selected.premise ?? '' })}
                >Revert</button
              >
              <button
                type="button"
                class="rounded bg-amber-400 px-3 py-1 text-sm text-black"
                onclick={() =>
                  store.update(selected.id, {
                    name: draft.name,
                    premise: draft.premise,
                    genreFlavor: (draft.genreFlavor || null) as never,
                    scale: (draft.scale || null) as never,
                    magicLevel: (draft.magicLevel || null) as never,
                    techLevel: (draft.techLevel || null) as never
                  })}>Save</button
              >
            </span>
          </div>
        {/if}

        <details class="rounded border border-red-200 bg-white p-4">
          <summary class="cursor-pointer text-sm font-medium text-red-700">Danger zone</summary>
          <div class="mt-3 space-y-2 text-sm">
            {#if selected.campaigns > 0}
              <p class="text-slate-600">
                Cannot delete: {selected.campaigns}
                {selected.campaigns === 1 ? 'Campaign uses' : 'Campaigns use'} this World.
                {archived ? 'Keep it archived.' : 'Archive it instead.'}
              </p>
              <button type="button" disabled class="rounded border px-3 py-1 opacity-50"
                >Delete World</button
              >
            {:else if confirmingDelete}
              <p>Permanently delete {selected.name}? This cannot be undone.</p>
              <button
                type="button"
                class="rounded bg-red-700 px-3 py-1 text-white"
                onclick={() => (refused = !store.remove(selected.id))}>Confirm delete</button
              >
              <button
                type="button"
                class="rounded border px-3 py-1"
                onclick={() => (confirmingDelete = false)}>Cancel</button
              >
            {:else}
              <button
                type="button"
                class="rounded border border-red-300 px-3 py-1 text-red-700"
                onclick={() => (confirmingDelete = true)}>Delete World</button
              >
            {/if}
            {#if refused}<p role="alert" class="text-red-600">Refused.</p>{/if}
          </div>
        </details>
      </div>
    {:else}
      <div class="mx-auto mt-24 max-w-sm space-y-3 text-center text-slate-500">
        <p>{tab === 'archived' ? 'No archived Worlds.' : 'No Worlds yet.'}</p>
        <button
          type="button"
          class="rounded bg-slate-800 px-3 py-2 text-white"
          onclick={() => (creating = true)}>Create your first World</button
        >
      </div>
    {/if}
  </section>
</div>

<Toast toast={store.toast} ondismiss={store.dismissToast} />
