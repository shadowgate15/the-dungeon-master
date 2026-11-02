<!-- PROTOTYPE (issue #74) Variant B: Worlds first. Left rail nav + World filter sidebar, row list (not a table), two-step dialog: 1) tick Worlds, 2) chat + Seed card. -->
<script lang="ts">
  import ChatStub from './ChatStub.svelte'
  import {
    LENGTHS, TONES, activeWorlds, blockers, campaignCount, store, world, worlds
  } from './proto-store.svelte.ts'

  let { worldFilter, view }: { worldFilter: string | null; view: 'active' | 'archived' } = $props()

  const rows = $derived(
    store.campaigns.filter(
      (c) => c.archived === (view === 'archived') && (!worldFilter || c.worldIds.includes(worldFilter))
    )
  )
  const href = (o: { world?: string | null; view?: string }) => {
    const p = new URLSearchParams({ variant: 'B' })
    if (o.world) p.set('world', o.world)
    if (o.view === 'archived') p.set('view', 'archived')
    return `?${p}`
  }

  let dialog = $state<HTMLDialogElement>()
  let step = $state<1 | 2>(1)
  let seed = $state({ name: '', premise: '', tone: '', length: '', worldIds: [] as string[] })
  const valid = $derived(seed.name && seed.premise && seed.tone && seed.length)
  function openNew() {
    step = 1
    seed = { name: '', premise: '', tone: '', length: '', worldIds: worldFilter ? [worldFilter] : [] }
    dialog?.showModal()
  }
  const toggle = (id: string) =>
    (seed.worldIds = seed.worldIds.includes(id) ? seed.worldIds.filter((x) => x !== id) : [...seed.worldIds, id])
</script>

<div class="flex min-h-screen">
  <aside class="w-56 shrink-0 space-y-6 border-r bg-slate-50 p-4 text-sm">
    <nav class="space-y-1">
      <a href="/" class="block rounded px-2 py-1 text-slate-600">Worlds</a>
      <a href="?variant=B" class="block rounded bg-slate-800 px-2 py-1 text-white">Campaigns</a>
    </nav>
    <div>
      <p class="mb-1 text-xs uppercase text-slate-500">Filter by World</p>
      <a href={href({ view })} class="flex justify-between rounded px-2 py-1 {!worldFilter ? 'bg-amber-100' : ''}">All <span>{store.campaigns.length}</span></a>
      {#each worlds as w}
        <a href={href({ world: w.id, view })} class="flex justify-between rounded px-2 py-1 {worldFilter === w.id ? 'bg-amber-100' : ''} {w.archived ? 'text-slate-400' : ''}">
          <span>{w.name}{w.archived ? ' (archived)' : ''}</span><span>{campaignCount(w.id)}</span>
        </a>
      {/each}
    </div>
  </aside>

  <main class="flex-1 space-y-4 p-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold">{worldFilter ? `Campaigns in ${world(worldFilter).name}` : 'Campaigns'}</h1>
      <div class="flex gap-3 text-sm">
        <a href={href({ world: worldFilter })} class={view === 'active' ? 'font-semibold underline' : ''}>Active</a>
        <a href={href({ world: worldFilter, view: 'archived' })} class={view === 'archived' ? 'font-semibold underline' : ''}>Archived</a>
        <button class="rounded bg-slate-800 px-3 py-2 text-white" onclick={openNew}>New Campaign</button>
      </div>
    </div>

    <ul class="divide-y rounded border">
      {#each rows as c (c.id)}
        {@const lock = blockers(c)}
        <li class="flex items-start gap-4 p-3 {lock.length ? 'bg-slate-50' : ''}">
          <div class="flex-1">
            <a href="/campaigns/{c.id}/edit" class="font-medium underline">{c.name}</a>
            <span class="ml-2 rounded bg-slate-200 px-1.5 text-xs">{c.tone}</span>
            <span class="rounded bg-slate-200 px-1.5 text-xs">{c.length}</span>
            <p class="text-sm text-slate-600">{c.premise}</p>
            <p class="mt-1 text-xs text-slate-500">
              {#each c.worldIds as id}<span class={world(id).archived ? 'line-through' : ''}>{world(id).name}</span>{' '}{/each}
            </p>
            {#if lock.length}<p class="mt-1 text-xs text-amber-700">🔒 Read-only until {lock.map((w) => w.name).join(' and ')} {lock.length > 1 ? 'are' : 'is'} restored.</p>{/if}
          </div>
          <details class="relative text-sm">
            <summary class="cursor-pointer list-none px-2">⋯</summary>
            <div class="absolute right-0 z-10 w-32 rounded border bg-white p-1 shadow">
              <button class="block w-full px-2 py-1 text-left" onclick={() => (c.archived = !c.archived)}>{c.archived ? 'Restore' : 'Archive'}</button>
              <button class="block w-full px-2 py-1 text-left text-red-700" onclick={() => confirm(`Delete ${c.name} forever?`) && (store.campaigns = store.campaigns.filter((x) => x.id !== c.id))}>Delete…</button>
            </div>
          </details>
        </li>
      {:else}
        <li class="p-8 text-center text-slate-500">{worldFilter ? 'No Campaigns use this World.' : 'No Campaigns here.'}</li>
      {/each}
    </ul>
  </main>
</div>

<dialog bind:this={dialog} aria-label="New Campaign" class="m-auto w-[min(60rem,calc(100vw-2rem))] rounded-lg p-6 backdrop:bg-black/50">
  <div class="mb-4 flex justify-between">
    <h2 class="text-xl font-semibold">New Campaign <span class="text-sm font-normal text-slate-500">· step {step} of 2</span></h2>
    <button onclick={() => dialog?.close()} class="text-sm underline">Close</button>
  </div>
  {#if step === 1}
    <p class="mb-2 text-sm">Where is it set? Pick at least one World.</p>
    <div class="grid gap-2 sm:grid-cols-2">
      {#each activeWorlds() as w}
        <label class="flex cursor-pointer items-center gap-3 rounded border p-3 {seed.worldIds.includes(w.id) ? 'border-slate-800 bg-slate-50' : ''}">
          <input type="checkbox" checked={seed.worldIds.includes(w.id)} onchange={() => toggle(w.id)} />
          <span class="flex-1"><strong>{w.name}</strong><br /><span class="text-xs text-slate-500">{w.genre} · {campaignCount(w.id)} Campaigns</span></span>
        </label>
      {/each}
    </div>
    <p class="mt-1 text-xs text-slate-400">1 archived World not shown.</p>
    <button class="mt-4 rounded bg-slate-800 px-3 py-2 text-white disabled:opacity-40" disabled={!seed.worldIds.length} onclick={() => (step = 2)}>Next: shape the Campaign →</button>
  {:else}
    <p class="mb-3 rounded bg-slate-50 p-2 text-sm">
      Set in <strong>{seed.worldIds.map((id) => world(id).name).join(', ')}</strong>
      <button class="ml-2 underline" onclick={() => (step = 1)}>Change Worlds</button>
    </p>
    <div class="grid gap-6 lg:grid-cols-2">
      <ChatStub worldIds={seed.worldIds} onaccept={(f, v) => ((seed as Record<string, unknown>)[f] = v)} />
      <div class="space-y-3">
        <label class="block"><span class="block text-sm font-medium">Name</span><input bind:value={seed.name} class="w-full rounded border p-2" /></label>
        <label class="block"><span class="block text-sm font-medium">Premise</span><textarea bind:value={seed.premise} rows="4" class="w-full rounded border p-2"></textarea></label>
        <div class="grid grid-cols-2 gap-3">
          <label><span class="block text-sm font-medium">Tone</span><select bind:value={seed.tone} class="w-full rounded border p-2"><option value="">Choose…</option>{#each TONES as t}<option>{t}</option>{/each}</select></label>
          <label><span class="block text-sm font-medium">Length</span><select bind:value={seed.length} class="w-full rounded border p-2"><option value="">Choose…</option>{#each LENGTHS as l}<option>{l}</option>{/each}</select></label>
        </div>
        <button class="rounded bg-slate-800 px-3 py-2 text-white disabled:opacity-40" disabled={!valid} onclick={() => { store.campaigns.unshift({ id: crypto.randomUUID(), ...seed, archived: false, updated: '2026-11-02' }); dialog?.close() }}>Create Campaign</button>
      </div>
    </div>
  {/if}
</dialog>
