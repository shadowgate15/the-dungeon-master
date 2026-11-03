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
  import Button from '#lib/ui/Button.svelte'
  import Checkbox from '#lib/ui/Checkbox.svelte'
  import Link from '#lib/ui/Link.svelte'
  import SegmentedNav from '#lib/ui/SegmentedNav.svelte'
  import Select from '#lib/ui/Select.svelte'
  import SortHeader from '#lib/ui/SortHeader.svelte'
  import Table from '#lib/ui/Table.svelte'
  import TextInput from '#lib/ui/TextInput.svelte'

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

  // A genre the current view no longer has would leave the table empty behind a blank select.
  $effect(() => {
    if (genre && !genres.includes(genre)) genre = ''
  })

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
  <div class="flex items-center gap-3">
    <div class="min-w-0 flex-1">
      <TextInput
        type="search"
        size="sm"
        aria-label="Search Worlds"
        placeholder="Search name or premise"
        bind:value={query}
      />
    </div>
    <div class="shrink-0">
      <Select size="sm" aria-label="Genre" bind:value={genre}>
        <option value="">All genres</option>
        {#each genres as g (g)}
          <option value={g}>{g}</option>
        {/each}
      </Select>
    </div>
    <SegmentedNav
      label="World view"
      items={[
        { href: resolve('/'), label: `Active ${activeCount}`, current: view === 'active' },
        {
          href: `${resolve('/')}?view=archived`,
          label: `Archived ${archivedCount}`,
          current: view === 'archived'
        }
      ]}
    />
  </div>

  <!-- Row checkboxes join this form through their form attribute; the bar needs JS to appear. -->
  <form id="bulk-actions" method="POST" use:enhance>
    {#if picked.length > 0}
      <div
        role="group"
        class="flex items-center gap-3 rounded-control border border-border bg-raised px-3 py-2 text-sm text-text"
      >
        <span class="mr-auto">{picked.length} selected</span>
        {#if view === 'active'}
          <Button type="submit" size="sm" formaction={actionUrl('archive')} form="bulk-actions"
            >Archive selected</Button
          >
        {:else}
          <Button type="submit" size="sm" formaction={actionUrl('restore')} form="bulk-actions"
            >Restore selected</Button
          >
        {/if}
        <Button type="button" variant="ghost" size="sm" onclick={() => (selected = [])}
          >Clear selection</Button
        >
      </div>
    {/if}
  </form>

  <Table>
    <thead class="border-b border-border text-xs text-muted uppercase">
      <tr>
        <th class="w-8 p-2">
          <Checkbox
            aria-label="Select all"
            checked={allPicked}
            onchange={() => (selected = allPicked ? [] : rows.map((row) => row.id))}
          />
        </th>
        <SortHeader sort={ariaSort('name')} onsort={() => sortBy('name')}>Name</SortHeader>
        <th class="p-2">Genre</th>
        <th class="p-2">Scale</th>
        <th class="p-2">Magic</th>
        <th class="p-2">Tech</th>
        <SortHeader sort={ariaSort('campaigns')} onsort={() => sortBy('campaigns')}
          >Campaigns</SortHeader
        >
        <SortHeader sort={ariaSort('updatedAt')} onsort={() => sortBy('updatedAt')}
          >Updated</SortHeader
        >
        <th class="p-2"><span class="sr-only">Actions</span></th>
      </tr>
    </thead>
    <tbody>
      {#each rows as world (world.id)}
        <tr class="border-b border-border align-top {picked.includes(world.id) ? 'bg-raised' : ''}">
          <td class="p-2">
            <Checkbox
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
              <p class="truncate text-xs text-muted" title={world.premise}>{world.premise}</p>
            {/if}
          </td>
          {#each [world.genreFlavor, world.scale, world.magicLevel, world.techLevel] as value, i (i)}
            <td class="p-2 {value ? '' : 'text-muted'}">{value ?? '—'}</td>
          {/each}
          <td class="p-2">
            {#if world.campaigns > 0}
              <Link href="{resolve('/campaigns')}?world={world.id}">{world.campaigns}</Link>
            {:else}
              —
            {/if}
          </td>
          <td class="p-2 whitespace-nowrap text-muted">{day(world.updatedAt)}</td>
          <td class="p-2 text-right">
            {#if confirmingDelete === world.id}
              <form method="POST" action={actionUrl('delete')} use:enhance class="inline">
                <input type="hidden" name="id" value={world.id} />
                <span class="text-xs">Delete forever?</span>
                <Button type="submit" variant="danger" size="sm">Confirm delete</Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onclick={() => (confirmingDelete = null)}>Cancel</Button
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
                <Button type="submit" variant="ghost" size="sm"
                  >{view === 'active' ? 'Archive' : 'Restore'}</Button
                >
              </form>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                class="text-danger"
                disabled={world.campaigns > 0}
                onclick={() => (confirmingDelete = world.id)}>Delete</Button
              >
              {#if world.campaigns > 0}
                <p class="text-xs text-muted">
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
          <td colspan="9" class="p-8 text-center text-muted">
            {#if worlds.length > 0}
              No Worlds match.
            {:else}
              {view === 'archived' ? 'No archived Worlds.' : 'No Worlds yet.'}
            {/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </Table>
</div>
