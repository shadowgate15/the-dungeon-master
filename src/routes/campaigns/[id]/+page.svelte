<script lang="ts">
  import { enhance } from '$app/forms'
  import { resolve } from '$app/paths'
  import CampaignSeedCard from '#lib/campaign/CampaignSeedCard.svelte'
  import CreationStepper from '#lib/campaign/CreationStepper.svelte'
  import { emptyCampaignSeed, type CampaignSeedCard as Seed } from '#lib/campaign/seed.ts'
  import Alert from '#lib/ui/Alert.svelte'
  import Button from '#lib/ui/Button.svelte'
  import Link from '#lib/ui/Link.svelte'
  import Panel from '#lib/ui/Panel.svelte'
  import DmBadge from '#lib/campaign/DmBadge.svelte'
  import { createSessionsQuery } from '#lib/live/client.ts'

  let { data, form } = $props()

  const sessions = createSessionsQuery(() => data.attached)

  // A failed save keeps what the Player typed; otherwise the card starts from the saved Seed.
  // svelte-ignore state_referenced_locally
  let seed = $state<Seed>({
    ...emptyCampaignSeed(),
    ...(data.seed ?? {}),
    ...(form && 'seed' in form ? form.seed : {})
  })
  let saved = $state(false)
  const archived = $derived(data.campaign.status === 'archived')
</script>

<svelte:head><title>{data.campaign.name}</title></svelte:head>

<main class="mx-auto max-w-3xl space-y-6 p-6">
  <Link href={resolve('/campaigns')} class="text-sm">All Campaigns</Link>
  <header class="space-y-1">
    <div class="flex items-center gap-3">
      <h1 class="font-display text-2xl">{data.campaign.name}</h1>
      {#if data.campaign.status !== 'missing'}
        <DmBadge attached={sessions.data.includes(data.campaign.id)} />
        <Link
          href={resolve('/campaigns/[id]/play', { id: data.campaign.id })}
          class="ml-auto text-sm">Play console</Link
        >
      {/if}
    </div>
    <p class="text-xs text-muted">{data.campaign.path}</p>
  </header>

  {#if data.campaign.status === 'missing'}
    <Alert variant="warning">
      This Campaign's folder is missing. Re-add it from the Campaign library to open it.
    </Alert>
  {:else}
    <CreationStepper
      current="Seed"
      hrefs={{
        Seed: resolve('/campaigns/[id]', { id: data.campaign.id }),
        Party: resolve('/campaigns/[id]/party', { id: data.campaign.id })
      }}
      unavailable={['Begin']}
    />

    {#if archived}
      <Alert variant="warning">This Campaign is archived. Restore it to change it.</Alert>
    {/if}

    <Panel title="Seed">
      <form
        method="POST"
        action="?/saveSeed"
        class="space-y-3"
        use:enhance={() => {
          saved = false
          return async ({ result, update }) => {
            await update({ reset: false })
            saved = result.type === 'success'
          }
        }}
        oninput={() => (saved = false)}
      >
        <CampaignSeedCard bind:seed disabled={archived} />
        {#if form && 'error' in form && form.error}
          <Alert variant="danger">{form.error}</Alert>
        {/if}
        {#if !archived}
          <div class="flex items-center gap-3">
            <Button type="submit">Save Seed</Button>
            {#if saved}<span class="text-sm text-muted">Saved</span>{/if}
          </div>
        {/if}
      </form>
    </Panel>
  {/if}
</main>
