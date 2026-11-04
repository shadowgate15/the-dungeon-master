<script module lang="ts">
  export type CharacterListItem = {
    id: string
    name: string
    raceName: string
    subraceName: string | null
    className: string
    backgroundName: string
    level: number
    updatedAt: number
  }
</script>

<script lang="ts">
  import type { Snippet } from 'svelte'
  import { resolve } from '$app/paths'
  import Link from '#lib/ui/Link.svelte'
  import SegmentedNav from '#lib/ui/SegmentedNav.svelte'
  import Table from '#lib/ui/Table.svelte'

  type Props = {
    characters: CharacterListItem[]
    view: 'active' | 'archived'
    activeCount: number
    archivedCount: number
    /** Per-row controls for the Actions column. */
    actions?: Snippet<[CharacterListItem]>
  }

  let { characters, view, activeCount, archivedCount, actions }: Props = $props()

  // e.g. "Hill Dwarf Cleric · Acolyte"
  const summary = (c: CharacterListItem) =>
    `${c.subraceName ?? c.raceName} ${c.className} · ${c.backgroundName}`

  // ISO date: the same string on the server and in the browser, whatever the locale.
  const day = (ms: number) => new Date(ms).toISOString().slice(0, 10)
</script>

<div class="space-y-4">
  <SegmentedNav
    label="Character view"
    items={[
      {
        href: resolve('/characters'),
        label: `Active ${activeCount}`,
        current: view === 'active'
      },
      {
        href: `${resolve('/characters')}?view=archived`,
        label: `Archived ${archivedCount}`,
        current: view === 'archived'
      }
    ]}
  />

  <Table>
    <thead class="border-b border-border text-xs text-muted uppercase">
      <tr>
        <th class="p-2">Name</th>
        <th class="p-2">Race</th>
        <th class="p-2">Class</th>
        <th class="p-2">Background</th>
        <th class="p-2">Level</th>
        <th class="p-2">Updated</th>
        <th class="p-2"><span class="sr-only">Actions</span></th>
      </tr>
    </thead>
    <tbody>
      {#each characters as character (character.id)}
        <tr class="border-b border-border align-top">
          <td class="max-w-xs p-2">
            <!-- The summary page is a later ticket, so the route is not yet in the typed list. -->
            <Link href="{resolve('/characters')}/{character.id}" class="font-medium text-text"
              >{character.name}</Link
            >
            <p class="truncate text-xs text-muted">{summary(character)}</p>
          </td>
          <td class="p-2">{character.raceName}</td>
          <td class="p-2">{character.className}</td>
          <td class="p-2">{character.backgroundName}</td>
          <td class="p-2">{character.level}</td>
          <td class="p-2 whitespace-nowrap text-muted">{day(character.updatedAt)}</td>
          <td class="p-2 text-right">{@render actions?.(character)}</td>
        </tr>
      {:else}
        <tr>
          <td colspan="7" class="p-8 text-center text-muted">
            {view === 'archived' ? 'No archived Characters.' : 'No Characters yet.'}
          </td>
        </tr>
      {/each}
    </tbody>
  </Table>
</div>
