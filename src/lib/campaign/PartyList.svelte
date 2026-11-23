<script lang="ts">
  import { resolve } from '$app/paths'
  import type { PartyMember } from '#lib/server/character/party.ts'
  import Badge from '#lib/ui/Badge.svelte'
  import Link from '#lib/ui/Link.svelte'

  type Props = {
    campaignId: string
    /** Saved Characters and drafts, in list order. */
    members: PartyMember[]
    /** The id of the Character or draft open in the wizard. */
    selected?: string | null
  }

  let { campaignId, members, selected = null }: Props = $props()

  const party = $derived(resolve('/campaigns/[id]/party', { id: campaignId }))
  const href = (m: PartyMember) =>
    `${party}?${m.kind === 'draft' ? 'draft' : 'character'}=${encodeURIComponent(m.id)}`
</script>

{#if members.length === 0}
  <p class="text-sm text-muted">No Characters yet.</p>
{:else}
  <ul class="divide-y divide-border rounded-panel border border-border">
    {#each members as m (m.id)}
      <li
        class={[
          'flex items-center justify-between gap-3 px-3 py-2',
          selected === m.id && 'bg-raised'
        ]}
        aria-current={selected === m.id ? 'true' : undefined}
      >
        <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- built from a resolved path -->
        <Link href={href(m)} class="font-semibold">{m.name || 'Unnamed Character'}</Link>
        {#if m.kind === 'draft'}
          <span class="flex items-center gap-2 text-sm text-muted">
            <Badge size="sm" variant="info">Draft</Badge>
            on {m.stepLabel}
          </span>
        {:else}
          <span class="flex items-center gap-2 text-sm text-muted">
            {m.description}
            {#if m.status !== 'alive'}<Badge size="sm">{m.status}</Badge>{/if}
          </span>
        {/if}
      </li>
    {/each}
  </ul>
{/if}
