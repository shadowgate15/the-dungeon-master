<!-- PROTOTYPE (issue #74) Variant C: Seed card is the hero. Header bar nav, World filter pills above a dense table, single-column dialog: Seed card with inline World toggle pills on top, chat as collapsible drawer below. -->
<script lang="ts">
  import ChatStub from './ChatStub.svelte'
  import { LENGTHS, TONES, activeWorlds, blockers, campaignCount, store, world, worlds } from './proto-store.svelte.ts'

  let { worldFilter, view }: { worldFilter: string | null; view: 'active' | 'archived' } = $props()

  const rows = $derived(
    store.campaigns.filter(
      (c) => c.archived === (view === 'archived') && (!worldFilter || c.worldIds.includes(worldFilter))
    )
  )
  const href = (o: { world?: string | null; view?: string }) => {
    const p = new URLSearchParams({ variant: 'C' })
    if (o.world) p.set('world', o.world)
    if (o.view === 'archived') p.set('view', 'archived')
    return `?${p}`
  }

  let dialog = $state<HTMLDialogElement>()
  let chatOpen = $state(false)
  let notice = $state('')
  let seed = $state({ name: '', premise: '', tone: '', length: '', worldIds: [] as string[] })
  const valid = $derived(seed.name && seed.premise && seed.tone && seed.length && seed.worldIds.length)
  function openNew() {
    seed = { name: '', premise: '', tone: '', length: '', worldIds: worldFilter ? [worldFilter] : [] }
    notice = ''
    dialog?.showModal()
  }
  function toggle(id: string) {
    if (seed.worldIds.includes(id)) {
      if (seed.worldIds.length === 1) return (notice = 'A Campaign needs at least one World.')
      seed.worldIds = seed.worldIds.filter((x) => x !== id)
    } else seed.worldIds = [...seed.worldIds, id]
    notice = ''
  }
</script>

<header class="flex items-center gap-6 bg-slate-900 px-6 py-3 text-sm text-white">
  <span class="font-semibold">The Dungeon Master</span>
  <a href="/" class="text-slate-300">Worlds</a>
  <a href="?variant=C" class="underline underline-offset-4">Campaigns</a>
  <button class="ml-auto rounded bg-amber-500 px-3 py-1.5 font-medium text-black" onclick={openNew}>+ New Campaign</button>
</header>

<main class="mx-auto max-w-6xl space-y-3 p-6">
  <div class="flex flex-wrap items-center gap-2 text-sm">
    <a href={href({ view })} class="rounded-full border px-3 py-1 {!worldFilter ? 'bg-slate-800 text-white' : ''}">All Worlds</a>
    {#each worlds as w}
      <a href={href({ world: w.id, view })} class="rounded-full border px-3 py-1 {worldFilter === w.id ? 'bg-slate-800 text-white' : ''} {w.archived ? 'border-dashed text-slate-400' : ''}">{w.name} · {campaignCount(w.id)}</a>
    {/each}
    <span class="ml-auto flex gap-3">
      <a href={href({ world: worldFilter })} class={view === 'active' ? 'font-semibold' : 'text-slate-500'}>Active</a>
      <a href={href({ world: worldFilter, view: 'archived' })} class={view === 'archived' ? 'font-semibold' : 'text-slate-500'}>Archived</a>
    </span>
  </div>

  <table class="w-full text-left text-sm">
    <tbody>
      {#each rows as c (c.id)}
        {@const lock = blockers(c)}
        <tr class="border-b {lock.length ? 'opacity-60' : ''}">
          <td class="w-6 p-2">{lock.length ? '🔒' : ''}</td>
          <td class="p-2"><a href="/campaigns/{c.id}/edit" class="font-medium underline">{c.name}</a>
            {#if lock.length}<span class="block text-xs text-amber-700">Blocked by archived {lock.map((w) => w.name).join(', ')}</span>{/if}</td>
          <td class="p-2 text-slate-500">{c.tone} · {c.length}</td>
          <td class="p-2">{c.worldIds.map((id) => world(id).name).join(' + ')}</td>
          <td class="p-2 text-right">
            <button class="px-1" onclick={() => (c.archived = !c.archived)}>{c.archived ? 'Restore' : 'Archive'}</button>
            <button class="px-1 text-red-700" onclick={() => confirm(`Delete ${c.name} forever?`) && (store.campaigns = store.campaigns.filter((x) => x.id !== c.id))}>Delete</button>
          </td>
        </tr>
      {:else}
        <tr><td class="p-10 text-center text-slate-500">{worldFilter ? 'Nothing in this World yet. ' : 'No Campaigns. '}<button class="underline" onclick={openNew}>Start one</button></td></tr>
      {/each}
    </tbody>
  </table>
</main>

<dialog bind:this={dialog} aria-label="New Campaign" class="m-auto w-[min(40rem,calc(100vw-2rem))] rounded-lg p-0 backdrop:bg-black/50">
  <div class="space-y-4 p-6">
    <div class="flex justify-between"><h2 class="text-xl font-semibold">New Campaign</h2><button onclick={() => dialog?.close()} class="text-sm underline">Close</button></div>

    <section class="space-y-3 rounded-lg border-2 border-slate-800 p-4">
      <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Campaign Seed</p>
      <div>
        <span class="mb-1 block text-sm font-medium">Worlds</span>
        <div class="flex flex-wrap gap-2">
          {#each activeWorlds() as w}
            <button type="button" aria-pressed={seed.worldIds.includes(w.id)} class="rounded-full border px-3 py-1 text-sm {seed.worldIds.includes(w.id) ? 'bg-slate-800 text-white' : ''}" onclick={() => toggle(w.id)}>{w.name}</button>
          {/each}
        </div>
        {#if notice}<p class="mt-1 text-xs text-red-600">{notice}</p>{/if}
      </div>
      <input placeholder="Name" bind:value={seed.name} class="w-full rounded border p-2" />
      <textarea placeholder="Premise" bind:value={seed.premise} rows="3" class="w-full rounded border p-2"></textarea>
      <div class="flex gap-2">
        <select bind:value={seed.tone} class="flex-1 rounded border p-2"><option value="">Tone…</option>{#each TONES as t}<option>{t}</option>{/each}</select>
        <select bind:value={seed.length} class="flex-1 rounded border p-2"><option value="">Length…</option>{#each LENGTHS as l}<option>{l}</option>{/each}</select>
      </div>
    </section>

    <button type="button" class="text-sm underline" onclick={() => (chatOpen = !chatOpen)}>{chatOpen ? 'Hide' : 'Fill it in with the AI'} {chatOpen ? '▲' : '▼'}</button>
    {#if chatOpen}<ChatStub worldIds={seed.worldIds} onaccept={(f, v) => ((seed as Record<string, unknown>)[f] = v)} />{/if}

    <button class="rounded bg-slate-800 px-3 py-2 text-white disabled:opacity-40" disabled={!valid} onclick={() => { store.campaigns.unshift({ id: crypto.randomUUID(), ...seed, archived: false, updated: '2026-11-02' }); dialog?.close() }}>Create Campaign</button>
  </div>
</dialog>
