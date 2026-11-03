<script lang="ts">
  import { resolve } from '$app/paths'
  import Alert from '#lib/ui/Alert.svelte'
  import Link from '#lib/ui/Link.svelte'
  import CampaignEditForm from '#lib/campaign/CampaignEditForm.svelte'
  import CampaignChat from '#lib/campaign/CampaignChat.svelte'
  import {
    emptyCampaignSeed,
    type CampaignSeedCard,
    type CampaignSeedField
  } from '#lib/campaign/seed.ts'

  let { data, form } = $props()

  // Failed saves echo what was typed; otherwise show the stored Campaign.
  const initial = $derived<CampaignSeedCard>(
    form && 'name' in form
      ? {
          name: String(form.name ?? ''),
          premise: String(form.premise ?? ''),
          tone: String(form.tone ?? ''),
          length: String(form.length ?? ''),
          worldIds: Array.isArray(form.worldIds) ? form.worldIds.map(String) : []
        }
      : {
          ...emptyCampaignSeed(data.campaign.worldIds),
          name: data.campaign.name,
          premise: data.campaign.premise,
          tone: data.campaign.tone,
          length: data.campaign.length
        }
  )
  const readOnly = $derived(data.blockingWorlds.length > 0)
</script>

<main class="mx-auto max-w-5xl space-y-6 p-6">
  <Link href={resolve('/campaigns')} class="text-sm">Back to Campaigns</Link>
  <h1 class="font-display text-2xl font-semibold text-text">Edit {data.campaign.name}</h1>

  {#if data.campaign.archived}
    <Alert variant="warning" role="status">
      This Campaign is archived and cannot be edited. Restore it to edit.
    </Alert>
  {:else if readOnly}
    <Alert variant="warning" role="status" class="space-y-2">
      <p>This Campaign is read-only while these Worlds are archived. Restore them to edit it.</p>
      <ul class="list-disc pl-5">
        {#each data.blockingWorlds as world (world.id)}
          <li>{world.name}</li>
        {/each}
      </ul>
    </Alert>
  {:else}
    {#key data.campaign.id}
      <CampaignEditForm
        {initial}
        {chat}
        worlds={data.worlds}
        error={form && 'error' in form ? String(form.error) : undefined}
        saved={form !== null && form !== undefined && 'saved' in form}
      />
    {/key}
  {/if}
</main>

{#snippet chat(seed: CampaignSeedCard, onaccept: (field: CampaignSeedField, value: string) => void)}
  <CampaignChat {seed} {onaccept} worlds={data.worlds} />
{/snippet}
