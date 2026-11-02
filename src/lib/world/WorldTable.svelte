<script module lang="ts">
  export type WorldListItem = {
    id: string
    name: string
    premise: string | null
    genreFlavor: string | null
    scale: string | null
    magicLevel: string | null
    techLevel: string | null
    updatedAt: number
    campaigns: number
  }
</script>

<script lang="ts">
  import { enhance } from '$app/forms'
  import { resolve } from '$app/paths'

  type Props = {
    worlds: WorldListItem[]
    view: 'active' | 'archived'
    activeCount: number
    archivedCount: number
  }

  let { worlds, view, activeCount, archivedCount }: Props = $props()

  type SortKey = 'name' | 'campaigns' | 'updatedAt'

  let query = $state('')
  let genre = $state('')
  let sortKey = $state<SortKey>('updatedAt')
  let sortDirection = $state<1 | -1>(-1)

  // Only genres that appear in this view, so the filter never offers an empty result.
  const genres = $derived([...new Set(worlds.map((w) => w.genreFlavor).filter((g) => g !== null))])
  const rows = $derived(
    worlds
      .filter(
        (w) =>
          (!genre || w.genreFlavor === genre) &&
          `${w.name} ${w.premise ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())
      )
      .toSorted((a, b) => {
        const [x, y] = [a[sortKey], b[sortKey]]
        const order =
          typeof x === 'string' ? x.localeCompare(y as string) : (x as number) - (y as number)
        return order * sortDirection
      })
  )

  let selected = $state<string[]>([])
  let confirmingDelete = $state<string | null>(null)
  // A World a filter hides is no longer selected, so a bulk action never touches unseen rows.
  const picked = $derived(selected.filter((id) => rows.some((row) => row.id === id)))
  const allPicked = $derived(rows.length > 0 && picked.length === rows.length)

  function toggle(id: string) {
    selected = picked.includes(id) ? picked.filter((p) => p !== id) : [...picked, id]
  }
  // An action URL replaces the query string, so keep the view or the table would jump to Active.
  const actionUrl = (name: string) =>
    view === 'archived' ? `?/${name}&view=archived` : `?/${name}`
  const campaignsLabel = (n: number) => `${n} ${n === 1 ? 'Campaign' : 'Campaigns'}`

  function sortBy(key: SortKey) {
    if (sortKey === key) {
      sortDirection = sortDirection === 1 ? -1 : 1
    } else {
      sortKey = key
      sortDirection = key === 'name' ? 1 : -1
    }
  }
  const ariaSort = (key: SortKey) =>
    sortKey === key ? (sortDirection === 1 ? 'ascending' : 'descending') : undefined
  // ISO date: the same string on the server and in the browser, whatever the locale.
  const day = (ms: number) => new Date(ms).toISOString().slice(0, 10)
</script>

<div class="space-y-4">
  <div class="flex flex-wrap items-center gap-3">
    <input
      type="search"
      aria-label="Search Worlds"
      placeholder="Search name or premise"
      bind:value={query}
      class="w-64 rounded border p-2 text-sm"
    />
    <select aria-label="Genre" bind:value={genre} class="rounded border p-2 text-sm">
      <option value="">All genres</option>
      {#each genres as g (g)}
        <option value={g}>{g}</option>
      {/each}
    </select>
    <nav aria-label="World view" class="flex overflow-hidden rounded border text-sm">
      <a
        href={resolve('/')}
        aria-current={view === 'active' ? 'page' : undefined}
        class="px-3 py-2 {view === 'active' ? 'bg-slate-800 text-white' : ''}"
        >Active {activeCount}</a
      >
      <a
        href="{resolve('/')}?view=archived"
        aria-current={view === 'archived' ? 'page' : undefined}
        class="px-3 py-2 {view === 'archived' ? 'bg-slate-800 text-white' : ''}"
        >Archived {archivedCount}</a
      >
    </nav>
  </div>

  <!-- Row checkboxes join this form through their form attribute; the bar needs JS to appear. -->
  <form id="bulk-actions" method="POST" use:enhance>
    {#if picked.length > 0}
      <div class="flex items-center gap-3 rounded bg-slate-900 px-4 py-2 text-sm text-white">
        <span class="mr-auto">{picked.length} selected</span>
        {#if view === 'active'}
          <button type="submit" formaction={actionUrl('archive')} form="bulk-actions"
            >Archive selected</button
          >
        {:else}
          <button type="submit" formaction={actionUrl('restore')} form="bulk-actions"
            >Restore selected</button
          >
        {/if}
        <button type="button" class="text-slate-400" onclick={() => (selected = [])}
          >Clear selection</button
        >
      </div>
    {/if}
  </form>

  <table class="w-full text-left text-sm">
    <thead class="border-b text-xs text-slate-500 uppercase">
      <tr>
        <th class="w-8 p-2">
          <input
            type="checkbox"
            aria-label="Select all"
            checked={allPicked}
            onchange={() => (selected = allPicked ? [] : rows.map((row) => row.id))}
          />
        </th>
        <th class="p-2" aria-sort={ariaSort('name')}>
          <button type="button" onclick={() => sortBy('name')}>Name</button>
        </th>
        <th class="p-2">Genre</th>
        <th class="p-2">Scale</th>
        <th class="p-2">Magic</th>
        <th class="p-2">Tech</th>
        <th class="p-2" aria-sort={ariaSort('campaigns')}>
          <button type="button" onclick={() => sortBy('campaigns')}>Campaigns</button>
        </th>
        <th class="p-2" aria-sort={ariaSort('updatedAt')}>
          <button type="button" onclick={() => sortBy('updatedAt')}>Updated</button>
        </th>
        <th class="p-2"><span class="sr-only">Actions</span></th>
      </tr>
    </thead>
    <tbody>
      {#each rows as world (world.id)}
        <tr class="border-b align-top {picked.includes(world.id) ? 'bg-amber-50' : ''}">
          <td class="p-2">
            <input
              type="checkbox"
              name="id"
              value={world.id}
              form="bulk-actions"
              aria-label="Select {world.name}"
              checked={picked.includes(world.id)}
              onchange={() => toggle(world.id)}
            />
          </td>
          <td class="max-w-xs p-2">
            <a href={resolve('/worlds/[id]/edit', { id: world.id })} class="font-medium underline"
              >{world.name}</a
            >
            {#if world.premise}
              <p class="truncate text-xs text-slate-500" title={world.premise}>{world.premise}</p>
            {/if}
          </td>
          {#each [world.genreFlavor, world.scale, world.magicLevel, world.techLevel] as value, i (i)}
            <td class="p-2 {value ? '' : 'text-slate-400'}">{value ?? '—'}</td>
          {/each}
          <td class="p-2">{world.campaigns || '—'}</td>
          <td class="p-2 whitespace-nowrap text-slate-500">{day(world.updatedAt)}</td>
          <td class="p-2 text-right">
            {#if confirmingDelete === world.id}
              <form method="POST" action={actionUrl('delete')} use:enhance class="inline">
                <input type="hidden" name="id" value={world.id} />
                <span class="text-xs">Delete forever?</span>
                <button type="submit" class="px-1 font-medium text-red-700">Confirm delete</button>
                <button type="button" class="px-1" onclick={() => (confirmingDelete = null)}
                  >Cancel</button
                >
              </form>
            {:else}
              <form
                method="POST"
                action={actionUrl(view === 'active' ? 'archive' : 'restore')}
                use:enhance
                class="inline"
              >
                <input type="hidden" name="id" value={world.id} />
                <button type="submit" class="px-1"
                  >{view === 'active' ? 'Archive' : 'Restore'}</button
                >
              </form>
              <button
                type="button"
                class="px-1 text-red-700 disabled:text-slate-400"
                disabled={world.campaigns > 0}
                onclick={() => (confirmingDelete = world.id)}>Delete</button
              >
              {#if world.campaigns > 0}
                <p class="text-xs text-slate-500">
                  Used by {campaignsLabel(world.campaigns)}. {view === 'active'
                    ? 'Archive it instead.'
                    : 'Keep it archived.'}
                </p>
              {/if}
            {/if}
          </td>
        </tr>
      {:else}
        <tr>
          <td colspan="9" class="p-8 text-center text-slate-500">
            {#if worlds.length > 0}
              No Worlds match.
            {:else}
              {view === 'archived' ? 'No archived Worlds.' : 'No Worlds yet.'}
            {/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
