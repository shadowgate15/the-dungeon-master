<script module lang="ts">
  export type CampaignListItem = {
    id: string
    name: string
    premise: string
    tone: string
    length: string
    updatedAt: number
    worlds: { id: string; name: string; archived: boolean }[]
  }
</script>

<script lang="ts">
  import type { Snippet } from 'svelte'
  import { resolve } from '$app/paths'

  type Props = {
    campaigns: CampaignListItem[]
    view: 'active' | 'archived'
    activeCount: number
    archivedCount: number
    /** The World the list is filtered to (`?world=ID`), if any. */
    worldFilter?: { id: string; name: string }
    /** Per-row controls for the Actions column. */
    actions?: Snippet<[CampaignListItem]>
  }

  let { campaigns, view, activeCount, archivedCount, worldFilter, actions }: Props = $props()

  // The query string for a view and World filter, each present only when set.
  const query = (opts: { view?: 'active' | 'archived'; world?: string }) => {
    const parts = [
      opts.view === 'archived' ? 'view=archived' : '',
      opts.world ? `world=${encodeURIComponent(opts.world)}` : ''
    ].filter(Boolean)
    return parts.length ? `?${parts.join('&')}` : ''
  }
  const blockingWorlds = (c: CampaignListItem) => c.worlds.filter((w) => w.archived)

  // ISO date: the same string on the server and in the browser, whatever the locale.
  const day = (ms: number) => new Date(ms).toISOString().slice(0, 10)
</script>

<div class="space-y-4">
  {#if worldFilter}
    <p class="flex items-center gap-3 rounded bg-slate-100 px-3 py-2 text-sm">
      <span>Showing Campaigns set in <strong>{worldFilter.name}</strong></span>
      <a href="{resolve('/campaigns')}{query({ view })}" class="underline">Clear filter</a>
    </p>
  {/if}

  <nav aria-label="Campaign view" class="flex w-fit overflow-hidden rounded border text-sm">
    <a
      href="{resolve('/campaigns')}{query({ world: worldFilter?.id })}"
      aria-current={view === 'active' ? 'page' : undefined}
      class="px-3 py-2 {view === 'active' ? 'bg-slate-800 text-white' : ''}">Active {activeCount}</a
    >
    <a
      href="{resolve('/campaigns')}{query({ view: 'archived', world: worldFilter?.id })}"
      aria-current={view === 'archived' ? 'page' : undefined}
      class="px-3 py-2 {view === 'archived' ? 'bg-slate-800 text-white' : ''}"
      >Archived {archivedCount}</a
    >
  </nav>

  <table class="w-full text-left text-sm">
    <thead class="border-b text-xs text-slate-500 uppercase">
      <tr>
        <th class="p-2">Name</th>
        <th class="p-2">Tone</th>
        <th class="p-2">Length</th>
        <th class="p-2">Worlds</th>
        <th class="p-2">Updated</th>
        <th class="p-2"><span class="sr-only">Actions</span></th>
      </tr>
    </thead>
    <tbody>
      {#each campaigns as campaign (campaign.id)}
        <tr class="border-b align-top">
          <td class="max-w-xs p-2">
            <span class="font-medium">{campaign.name}</span>
            <p class="truncate text-xs text-slate-500" title={campaign.premise}>
              {campaign.premise}
            </p>
            {#if blockingWorlds(campaign).length > 0}
              <p class="mt-1 text-xs">
                <span class="rounded bg-amber-100 px-1.5 text-amber-800">Read-only</span>
                Restore {blockingWorlds(campaign)
                  .map((w) => w.name)
                  .join(', ')} to edit this Campaign.
              </p>
            {/if}
          </td>
          <td class="p-2">{campaign.tone}</td>
          <td class="p-2">{campaign.length}</td>
          <td class="p-2">
            {#each campaign.worlds as world (world.id)}
              <a
                href="{resolve('/campaigns')}{query({ view, world: world.id })}"
                class="mr-1 inline-block rounded border px-1.5 text-xs {world.archived
                  ? 'border-dashed line-through'
                  : ''}">{world.name}</a
              >
            {/each}
          </td>
          <td class="p-2 whitespace-nowrap text-slate-500">{day(campaign.updatedAt)}</td>
          <td class="p-2 text-right">{@render actions?.(campaign)}</td>
        </tr>
      {:else}
        <tr>
          <td colspan="6" class="p-8 text-center text-slate-500">
            {#if worldFilter}
              No Campaigns match.
            {:else}
              {view === 'archived' ? 'No archived Campaigns.' : 'No Campaigns yet.'}
            {/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
