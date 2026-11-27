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
  import { seedQueryKey } from '#lib/live/messages.ts'
  import { createSeedQuery } from '#lib/creation/client.ts'
  import CreationPage from '#lib/creation/CreationPage.svelte'
  import { useQueryClient } from '@tanstack/svelte-query'
  import { untrack } from 'svelte'

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
  const locked = $derived(data.begun)
  const attached = $derived(sessions.data.includes(data.campaign.id))

  // The stored Seed: a DM write ("✎ DM") refetches it and its fields land in the open card.
  const queryClient = useQueryClient()
  const stored = createSeedQuery(
    () => data.campaign.id,
    () => ({ seed: { ...emptyCampaignSeed(), ...(data.seed ?? {}) }, dmFields: data.dmFields })
  )
  let merged = untrack(() => stored.data)
  $effect(() => {
    const next = stored.data
    untrack(() => {
      if (next === merged) return
      for (const field of next.dmFields as (keyof Seed)[]) {
        if (next.seed[field] !== merged.seed[field]) seed[field] = next.seed[field]
      }
      merged = next
    })
  })
  // A field keeps its mark until the Player changes it.
  const dmFields = $derived(
    (stored.data.dmFields as (keyof Seed)[]).filter((f) => seed[f] === stored.data.seed[f])
  )
</script>

<svelte:head><title>{data.campaign.name}</title></svelte:head>

<CreationPage
  width="narrow"
  pane={data.campaign.status === 'missing'
    ? null
    : {
        campaign: data.campaign.id,
        folder: data.campaign.path,
        attached,
        messages: data.conversation,
        disabled: archived
      }}
>
  {#if data.isHost}
    <Link href={resolve('/campaigns')} class="text-sm">All Campaigns</Link>
  {/if}
  <header class="space-y-1">
    <div class="flex items-center gap-3">
      <h1 class="font-display text-2xl">{data.campaign.name}</h1>
      {#if data.campaign.status !== 'missing'}
        <DmBadge {attached} />
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
        Party: resolve('/campaigns/[id]/party', { id: data.campaign.id }),
        Begin: resolve('/campaigns/[id]/begin', { id: data.campaign.id })
      }}
    />

    {#if archived}
      <Alert variant="warning">This Campaign is archived. Restore it to change it.</Alert>
    {:else if locked}
      <Alert variant="info">
        The story has begun, so the Seed is locked.
        {#if data.isHost}
          <Link href={resolve('/campaigns/[id]/begin', { id: data.campaign.id })}>Start over</Link>
          (until the first Narration) to change it.
        {:else}
          Only the Host can start over.
        {/if}
      </Alert>
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
            await queryClient.invalidateQueries({ queryKey: seedQueryKey(data.campaign.id) })
          }
        }}
        oninput={() => (saved = false)}
      >
        <CampaignSeedCard bind:seed disabled={archived || locked || !data.isHost} {dmFields} />
        {#if form && 'error' in form && form.error}
          <Alert variant="danger">{form.error}</Alert>
        {/if}
        {#if !archived && !locked && data.isHost}
          <div class="flex items-center gap-3">
            <Button type="submit">Save Seed</Button>
            {#if saved}<span class="text-sm text-muted">Saved</span>{/if}
          </div>
        {/if}
      </form>
    </Panel>
  {/if}
</CreationPage>
