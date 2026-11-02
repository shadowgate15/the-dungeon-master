<!-- PROTOTYPE (issue #74) Variant A: mirror the Worlds page. Top tab nav, table, modal dialog (chat left, Seed card right), World picker = chips + "Add World" select. -->
<script lang="ts">
  import ChatStub from './ChatStub.svelte'
  import {
    LENGTHS, TONES, activeWorlds, blockers, store, world, worlds,
    type ProtoCampaign
  } from './proto-store.svelte.ts'

  let { worldFilter, view }: { worldFilter: string | null; view: 'active' | 'archived' } = $props()

  const rows = $derived(
    store.campaigns.filter(
      (c) => c.archived === (view === 'archived') && (!worldFilter || c.worldIds.includes(worldFilter))
    )
  )
  const href = (o: { world?: string | null; view?: string }) => {
    const p = new URLSearchParams({ variant: 'A' })
    if (o.world) p.set('world', o.world)
    if (o.view === 'archived') p.set('view', 'archived')
    return `?${p}`
  }

  let confirming = $state<string | null>(null)
  let dialog = $state<HTMLDialogElement>()
  let seed = $state({ name: '', premise: '', tone: '', length: '', worldIds: [] as string[] })
  let adding = $state('')
  const addable = $derived(activeWorlds().filter((w) => !seed.worldIds.includes(w.id)))
  const valid = $derived(seed.name && seed.premise && seed.tone && seed.length && seed.worldIds.length)

  function openNew() {
    seed = { name: '', premise: '', tone: '', length: '', worldIds: worldFilter ? [worldFilter] : [] }
    dialog?.showModal()
  }
  function create() {
    store.campaigns.unshift({
      id: crypto.randomUUID(), ...seed, archived: false, updated: '2026-11-02'
    })
    dialog?.close()
  }
</script>

<main class="mx-auto max-w-6xl space-y-4 p-6">
  <nav class="flex gap-4 border-b text-sm">
    <a href="/" class="pb-2 text-slate-500">Worlds</a>
    <a href="?variant=A" class="border-b-2 border-slate-800 pb-2 font-medium">Campaigns</a>
  </nav>
  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-semibold">Campaigns</h1>
    <button class="rounded bg-slate-800 px-3 py-2 text-white" onclick={openNew}>New Campaign</button>
  </div>

  {#if worldFilter}
    <p class="flex items-center gap-2 rounded bg-amber-50 px-3 py-2 text-sm">
      Showing Campaigns in <strong>{world(worldFilter).name}</strong>
      <a href={href({ view })} class="ml-auto underline">Clear filter</a>
    </p>
  {/if}

  <div class="flex gap-3 text-sm">
    <input type="search" placeholder="Search name or premise" class="w-64 rounded border p-2" />
    <select class="rounded border p-2"><option>All tones</option>{#each TONES as t}<option>{t}</option>{/each}</select>
    <nav class="ml-auto flex overflow-hidden rounded border">
      <a href={href({ world: worldFilter })} class="px-3 py-2 {view === 'active' ? 'bg-slate-800 text-white' : ''}">Active {store.campaigns.filter((c) => !c.archived).length}</a>
      <a href={href({ world: worldFilter, view: 'archived' })} class="px-3 py-2 {view === 'archived' ? 'bg-slate-800 text-white' : ''}">Archived {store.campaigns.filter((c) => c.archived).length}</a>
    </nav>
  </div>

  <table class="w-full text-left text-sm">
    <thead class="border-b text-xs uppercase text-slate-500">
      <tr><th class="p-2">Name</th><th class="p-2">Tone</th><th class="p-2">Length</th><th class="p-2">Worlds</th><th class="p-2">Updated</th><th class="p-2"></th></tr>
    </thead>
    <tbody>
      {#each rows as c (c.id)}
        {@const lock = blockers(c)}
        <tr class="border-b align-top {lock.length ? 'bg-slate-50 text-slate-500' : ''}">
          <td class="max-w-xs p-2">
            <a href="/campaigns/{c.id}/edit" class="font-medium underline">{c.name}</a>
            {#if lock.length}<span class="ml-1 rounded bg-slate-200 px-1 text-xs">Read-only</span>{/if}
            <p class="truncate text-xs text-slate-500">{c.premise}</p>
            {#if lock.length}<p class="text-xs">Archived World: {lock.map((w) => w.name).join(', ')}. Restore it to edit.</p>{/if}
          </td>
          <td class="p-2">{c.tone}</td>
          <td class="p-2">{c.length}</td>
          <td class="p-2">
            {#each c.worldIds as id}
              <a href={href({ world: id })} class="mr-1 inline-block rounded border px-1.5 text-xs {world(id).archived ? 'border-dashed line-through' : ''}">{world(id).name}</a>
            {/each}
          </td>
          <td class="p-2 whitespace-nowrap">{c.updated}</td>
          <td class="p-2 text-right">
            {#if confirming === c.id}
              <span class="text-xs">Delete forever?</span>
              <button class="px-1 font-medium text-red-700" onclick={() => { store.campaigns = store.campaigns.filter((x) => x.id !== c.id); confirming = null }}>Confirm delete</button>
              <button class="px-1" onclick={() => (confirming = null)}>Cancel</button>
            {:else}
              <button class="px-1" onclick={() => (c.archived = !c.archived)}>{c.archived ? 'Restore' : 'Archive'}</button>
              <button class="px-1 text-red-700" onclick={() => (confirming = c.id)}>Delete</button>
            {/if}
          </td>
        </tr>
      {:else}
        <tr><td colspan="6" class="p-8 text-center text-slate-500">{worldFilter ? 'No Campaigns use this World.' : view === 'archived' ? 'No archived Campaigns.' : 'No Campaigns yet.'}</td></tr>
      {/each}
    </tbody>
  </table>
</main>

<dialog bind:this={dialog} aria-label="New Campaign" class="m-auto w-[min(72rem,calc(100vw-2rem))] rounded-lg p-6 backdrop:bg-black/50">
  <div class="mb-4 flex justify-between"><h2 class="text-xl font-semibold">New Campaign</h2><button onclick={() => dialog?.close()} class="text-sm underline">Close</button></div>
  <div class="grid gap-6 lg:grid-cols-2">
    <ChatStub worldIds={seed.worldIds} onaccept={(f, v) => ((seed as Record<string, unknown>)[f] = v)} />
    <div class="space-y-3">
      <!-- World picker: chips + add select -->
      <div>
        <span class="block text-sm font-medium">Worlds</span>
        <div class="flex flex-wrap items-center gap-2 rounded border p-2">
          {#each seed.worldIds as id}
            <span class="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-0.5 text-sm text-white">
              {world(id).name}
              <button type="button" aria-label="Remove {world(id).name}" disabled={seed.worldIds.length === 1} class="disabled:opacity-30" onclick={() => (seed.worldIds = seed.worldIds.filter((x) => x !== id))}>✕</button>
            </span>
          {/each}
          <select bind:value={adding} onchange={() => { if (adding) seed.worldIds = [...seed.worldIds, adding]; adding = '' }} class="rounded border p-1 text-sm" disabled={!addable.length}>
            <option value="">+ Add World</option>
            {#each addable as w}<option value={w.id}>{w.name} ({w.genre})</option>{/each}
          </select>
        </div>
        {#if seed.worldIds.length === 0}
          <p class="text-xs text-red-600">A Campaign needs at least one World.</p>
        {:else if seed.worldIds.length === 1}
          <p class="text-xs text-slate-500">The last World can't be removed. Add another first to swap.</p>
        {/if}
        {#if worlds.some((w) => w.archived)}<p class="text-xs text-slate-400">Archived Worlds aren't offered.</p>{/if}
      </div>
      <label class="block"><span class="block text-sm font-medium">Name</span><input bind:value={seed.name} class="w-full rounded border p-2" /></label>
      <label class="block"><span class="block text-sm font-medium">Premise</span><textarea bind:value={seed.premise} rows="4" class="w-full rounded border p-2"></textarea></label>
      <div class="grid grid-cols-2 gap-3">
        <label><span class="block text-sm font-medium">Tone</span><select bind:value={seed.tone} class="w-full rounded border p-2"><option value="">Choose…</option>{#each TONES as t}<option>{t}</option>{/each}</select></label>
        <label><span class="block text-sm font-medium">Length</span><select bind:value={seed.length} class="w-full rounded border p-2"><option value="">Choose…</option>{#each LENGTHS as l}<option>{l}</option>{/each}</select></label>
      </div>
      <button class="rounded bg-slate-800 px-3 py-2 text-white disabled:opacity-40" disabled={!valid} onclick={create}>Create Campaign</button>
    </div>
  </div>
</dialog>
