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
  import Alert from '#lib/ui/Alert.svelte'
  import Badge from '#lib/ui/Badge.svelte'
  import Link from '#lib/ui/Link.svelte'
  import SegmentedNav from '#lib/ui/SegmentedNav.svelte'
  import Table from '#lib/ui/Table.svelte'

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
    <Alert variant="info" class="flex items-center gap-3">
      <span>Showing Campaigns set in <strong>{worldFilter.name}</strong></span>
      <Link href="{resolve('/campaigns')}{query({ view })}">Clear filter</Link>
    </Alert>
  {/if}

  <SegmentedNav
    label="Campaign view"
    items={[
      {
        href: `${resolve('/campaigns')}${query({ world: worldFilter?.id })}`,
        label: `Active ${activeCount}`,
        current: view === 'active'
      },
      {
        href: `${resolve('/campaigns')}${query({ view: 'archived', world: worldFilter?.id })}`,
        label: `Archived ${archivedCount}`,
        current: view === 'archived'
      }
    ]}
  />

  <Table>
    <thead class="border-b border-border text-xs text-muted uppercase">
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
        <tr class="border-b border-border align-top">
          <td class="max-w-xs p-2">
            <Link
              href={resolve('/campaigns/[id]/edit', { id: campaign.id })}
              class="font-medium text-text">{campaign.name}</Link
            >
            <p class="truncate text-xs text-muted" title={campaign.premise}>
              {campaign.premise}
            </p>
            {#if blockingWorlds(campaign).length > 0}
              <p class="mt-1 text-xs">
                <Badge variant="warning" size="sm">Read-only</Badge>
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
              <Link
                href="{resolve('/campaigns')}{query({ view, world: world.id })}"
                class="mr-1 inline-block rounded-full border px-2 py-0.5 text-xs text-text no-underline hover:bg-raised {world.archived
                  ? 'border-dashed border-muted line-through'
                  : 'border-border'}">{world.name}</Link
              >
            {/each}
          </td>
          <td class="p-2 whitespace-nowrap text-muted">{day(campaign.updatedAt)}</td>
          <td class="p-2 text-right">{@render actions?.(campaign)}</td>
        </tr>
      {:else}
        <tr>
          <td colspan="6" class="p-8 text-center text-muted">
            {#if worldFilter}
              No Campaigns match.
            {:else}
              {view === 'archived' ? 'No archived Campaigns.' : 'No Campaigns yet.'}
            {/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </Table>
</div>
