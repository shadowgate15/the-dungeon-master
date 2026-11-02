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
    /** Per-row controls for the Actions column (archive, restore, delete arrive with the edit ticket). */
    actions?: Snippet<[CampaignListItem]>
  }

  let { campaigns, view, activeCount, archivedCount, actions }: Props = $props()

  // ISO date: the same string on the server and in the browser, whatever the locale.
  const day = (ms: number) => new Date(ms).toISOString().slice(0, 10)
</script>

<div class="space-y-4">
  <nav aria-label="Campaign view" class="flex w-fit overflow-hidden rounded border text-sm">
    <a
      href={resolve('/campaigns')}
      aria-current={view === 'active' ? 'page' : undefined}
      class="px-3 py-2 {view === 'active' ? 'bg-slate-800 text-white' : ''}">Active {activeCount}</a
    >
    <a
      href="{resolve('/campaigns')}?view=archived"
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
          </td>
          <td class="p-2">{campaign.tone}</td>
          <td class="p-2">{campaign.length}</td>
          <td class="p-2">
            {#each campaign.worlds as world (world.id)}
              <span
                class="mr-1 inline-block rounded border px-1.5 text-xs {world.archived
                  ? 'border-dashed line-through'
                  : ''}">{world.name}</span
              >
            {/each}
          </td>
          <td class="p-2 whitespace-nowrap text-slate-500">{day(campaign.updatedAt)}</td>
          <td class="p-2 text-right">{@render actions?.(campaign)}</td>
        </tr>
      {:else}
        <tr>
          <td colspan="6" class="p-8 text-center text-slate-500">
            {view === 'archived' ? 'No archived Campaigns.' : 'No Campaigns yet.'}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
