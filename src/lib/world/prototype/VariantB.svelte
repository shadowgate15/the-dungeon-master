<script lang="ts">
  // PROTOTYPE variant B: dense table. Everything about every World at a glance, sortable and
  // filterable, with bulk actions and per-row actions. Creating happens in a dialog.
  import type { Snippet } from 'svelte'
  import { resolve } from '$app/paths'
  import { ago, type ProtoWorld, type createProtoStore } from './store.svelte.ts'
  import Toast from './Toast.svelte'

  let {
    store,
    conversation,
    seedForm
  }: {
    store: ReturnType<typeof createProtoStore>
    conversation: Snippet
    seedForm: Snippet
  } = $props()

  let view = $state<'active' | 'archived'>('active')
  let query = $state('')
  let genre = $state('')
  let sortKey = $state<'name' | 'updatedAt' | 'campaigns'>('updatedAt')
  let sortDir = $state<1 | -1>(-1)
  let selected = $state<string[]>([])
  let dialog = $state<HTMLDialogElement>()
  let deleting = $state<string | null>(null)
  let notice = $state('')

  const genres = $derived([...new Set(store.worlds.map((w) => w.genreFlavor).filter(Boolean))])
  const rows = $derived(
    (view === 'active' ? store.active : store.archived)
      .filter(
        (w) =>
          (!genre || w.genreFlavor === genre) &&
          (w.name + w.premise).toLowerCase().includes(query.toLowerCase())
      )
      .toSorted((a: ProtoWorld, b: ProtoWorld) => {
        const [x, y] = [a[sortKey], b[sortKey]]
        return (x < y ? -1 : x > y ? 1 : 0) * sortDir
      })
  )
  const picked = $derived(selected.filter((id) => rows.some((r) => r.id === id)))
  const allPicked = $derived(rows.length > 0 && picked.length === rows.length)

  function sortBy(key: typeof sortKey) {
    if (sortKey === key) {
      sortDir = (sortDir * -1) as 1 | -1
    } else {
      sortKey = key
      sortDir = key === 'name' ? 1 : -1
    }
  }
  const arrow = (key: string) => (sortKey === key ? (sortDir === 1 ? ' ▲' : ' ▼') : '')
  function tryDelete(w: ProtoWorld) {
    if (store.remove(w.id)) notice = ''
    else notice = `${w.name} is used by a Campaign. Archive it instead.`
    deleting = null
  }
</script>

<div class="min-h-screen bg-white p-6 pb-24 text-slate-900">
  <div class="mx-auto max-w-6xl space-y-4">
    <header class="flex flex-wrap items-center gap-3">
      <h1 class="mr-auto text-2xl font-semibold">Worlds</h1>
      <input
        type="search"
        placeholder="Search name or premise"
        bind:value={query}
        class="w-64 rounded border p-2 text-sm"
      />
      <select bind:value={genre} class="rounded border p-2 text-sm">
        <option value="">All genres</option>
        {#each genres as g (g)}<option value={g}>{g}</option>{/each}
      </select>
      <div class="flex overflow-hidden rounded border text-sm" role="tablist">
        {#each [['active', `Active ${store.active.length}`], ['archived', `Archived ${store.archived.length}`]] as const as [key, label] (key)}
          <button
            type="button"
            role="tab"
            aria-selected={view === key}
            class="px-3 py-2 {view === key ? 'bg-slate-800 text-white' : ''}"
            onclick={() => ((view = key), (selected = []))}>{label}</button
          >
        {/each}
      </div>
      <button
        type="button"
        class="rounded bg-amber-500 px-4 py-2 text-sm font-medium text-black"
        onclick={() => dialog?.showModal()}>New World</button
      >
    </header>

    {#if store.seeded}
      <p class="rounded bg-amber-100 p-2 text-xs">Sample data: database has no Worlds.</p>
    {/if}
    {#if notice}
      <p role="alert" class="rounded bg-red-50 p-2 text-sm text-red-700">{notice}</p>
    {/if}

    {#if picked.length > 0}
      <div class="flex items-center gap-3 rounded bg-slate-900 px-4 py-2 text-sm text-white">
        <span class="mr-auto">{picked.length} selected</span>
        {#if view === 'active'}
          <button type="button" onclick={() => (store.archive(picked), (selected = []))}
            >Archive</button
          >
        {:else}
          <button type="button" onclick={() => (store.restore(picked), (selected = []))}
            >Restore</button
          >
        {/if}
        <button type="button" class="text-slate-400" onclick={() => (selected = [])}>Clear</button>
      </div>
    {/if}

    <table class="w-full text-left text-sm">
      <thead class="border-b text-xs text-slate-500 uppercase">
        <tr>
          <th class="w-8 p-2">
            <input
              type="checkbox"
              aria-label="Select all"
              checked={allPicked}
              onchange={() => (selected = allPicked ? [] : rows.map((r) => r.id))}
            />
          </th>
          <th class="p-2"
            ><button type="button" onclick={() => sortBy('name')}>Name{arrow('name')}</button></th
          >
          <th class="p-2">Genre</th>
          <th class="p-2">Scale</th>
          <th class="p-2">Magic</th>
          <th class="p-2">Tech</th>
          <th class="p-2"
            ><button type="button" onclick={() => sortBy('campaigns')}
              >Campaigns{arrow('campaigns')}</button
            ></th
          >
          <th class="p-2"
            ><button type="button" onclick={() => sortBy('updatedAt')}
              >Updated{arrow('updatedAt')}</button
            ></th
          >
          <th class="p-2"></th>
        </tr>
      </thead>
      <tbody>
        {#each rows as w (w.id)}
          <tr
            class="group border-b align-top hover:bg-slate-50 {picked.includes(w.id)
              ? 'bg-amber-50'
              : ''}"
          >
            <td class="p-2">
              <input
                type="checkbox"
                aria-label="Select {w.name}"
                checked={picked.includes(w.id)}
                onchange={() =>
                  (selected = picked.includes(w.id)
                    ? picked.filter((i) => i !== w.id)
                    : [...picked, w.id])}
              />
            </td>
            <td class="max-w-xs p-2">
              <a href={resolve('/worlds/[id]/edit', { id: w.id })} class="font-medium underline"
                >{w.name}</a
              >
              <p class="truncate text-xs text-slate-500" title={w.premise}>{w.premise}</p>
            </td>
            {#each [w.genreFlavor, w.scale, w.magicLevel, w.techLevel] as v, i (i)}
              <td class="p-2 {v ? '' : 'text-slate-300'}">{v ?? '—'}</td>
            {/each}
            <td class="p-2">{w.campaigns || '—'}</td>
            <td class="p-2 whitespace-nowrap text-slate-500">{ago(w.updatedAt)}</td>
            <td class="p-2 text-right whitespace-nowrap">
              {#if deleting === w.id}
                <span class="text-xs">Delete forever?</span>
                <button type="button" class="font-medium text-red-700" onclick={() => tryDelete(w)}
                  >Yes</button
                >
                <button type="button" onclick={() => (deleting = null)}>No</button>
              {:else}
                <span class="opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
                  {#if w.archivedAt === null}
                    <button type="button" class="px-1" onclick={() => store.archive([w.id])}
                      >Archive</button
                    >
                  {:else}
                    <button type="button" class="px-1" onclick={() => store.restore([w.id])}
                      >Restore</button
                    >
                  {/if}
                  <button type="button" class="px-1 text-red-700" onclick={() => (deleting = w.id)}
                    >Delete</button
                  >
                </span>
              {/if}
            </td>
          </tr>
        {:else}
          <tr><td colspan="9" class="p-8 text-center text-slate-500">No Worlds match.</td></tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>

<dialog
  bind:this={dialog}
  class="m-auto w-[min(72rem,calc(100vw-2rem))] rounded p-6 backdrop:bg-black/40"
>
  <div class="mb-3 flex items-center justify-between">
    <h2 class="text-xl font-semibold">New World</h2>
    <button type="button" aria-label="Close" onclick={() => dialog?.close()}>✕</button>
  </div>
  <div class="grid gap-6 lg:grid-cols-2">
    <section aria-label="Conversation" class="max-h-[70vh] min-w-0 space-y-2 overflow-y-auto">
      {@render conversation()}
    </section>
    <section aria-label="Seed card" class="max-h-[70vh] min-w-0 overflow-y-auto">
      {@render seedForm()}
    </section>
  </div>
</dialog>

<Toast toast={store.toast} ondismiss={store.dismissToast} />
