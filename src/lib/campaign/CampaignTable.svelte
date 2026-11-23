<script module lang="ts">
  export type CampaignListItem = {
    id: string
    name: string
    /** Unset Seed fields are null, and a Missing Campaign has only its cached name. */
    premise: string | null
    tone: string | null
    length: string | null
    updatedAt: number | null
    status: 'active' | 'archived' | 'missing'
    /** The Campaign folder. */
    path: string
  }
</script>

<script lang="ts">
  import type { Snippet } from 'svelte'
  import { resolve } from '$app/paths'
  import Badge from '#lib/ui/Badge.svelte'
  import Link from '#lib/ui/Link.svelte'
  import SegmentedNav from '#lib/ui/SegmentedNav.svelte'
  import Table from '#lib/ui/Table.svelte'

  type Props = {
    campaigns: CampaignListItem[]
    view: 'active' | 'archived'
    activeCount: number
    archivedCount: number
    /** Per-row controls for the Actions column. */
    actions?: Snippet<[CampaignListItem]>
  }

  let { campaigns, view, activeCount, archivedCount, actions }: Props = $props()

  // ISO date: the same string on the server and in the browser, whatever the locale.
  const day = (ms: number) => new Date(ms).toISOString().slice(0, 10)
</script>

<div class="space-y-4">
  <SegmentedNav
    label="Campaign view"
    items={[
      {
        href: resolve('/campaigns'),
        label: `Active ${activeCount}`,
        current: view === 'active'
      },
      {
        href: `${resolve('/campaigns')}?view=archived`,
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
        <th class="p-2">Updated</th>
        <th class="p-2"><span class="sr-only">Actions</span></th>
      </tr>
    </thead>
    <tbody>
      {#each campaigns as campaign (campaign.id)}
        <tr class="border-b border-border align-top">
          <td class="max-w-xs p-2">
            {#if campaign.status === 'missing'}
              <span class="font-medium">{campaign.name}</span>
              <Badge variant="warning" size="sm">Missing</Badge>
              <p class="truncate text-xs text-muted" title={campaign.path}>
                Not found at {campaign.path}
              </p>
            {:else}
              <Link
                href={resolve('/campaigns/[id]', { id: campaign.id })}
                class="font-medium text-text">{campaign.name}</Link
              >
              <p class="truncate text-xs text-muted" title={campaign.premise ?? undefined}>
                {campaign.premise ?? ''}
              </p>
            {/if}
          </td>
          <td class="p-2">{campaign.tone ?? ''}</td>
          <td class="p-2">{campaign.length ?? ''}</td>
          <td class="p-2 whitespace-nowrap text-muted">
            {campaign.updatedAt === null ? '' : day(campaign.updatedAt)}
          </td>
          <td class="p-2 text-right">{@render actions?.(campaign)}</td>
        </tr>
      {:else}
        <tr>
          <td colspan="5" class="p-8 text-center text-muted">
            {view === 'archived' ? 'No archived Campaigns.' : 'No Campaigns yet.'}
          </td>
        </tr>
      {/each}
    </tbody>
  </Table>
</div>
