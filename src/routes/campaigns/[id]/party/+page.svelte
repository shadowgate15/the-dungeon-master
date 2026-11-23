<script lang="ts">
  import { enhance } from '$app/forms'
  import { resolve } from '$app/paths'
  import CreationStepper from '#lib/campaign/CreationStepper.svelte'
  import PartyList from '#lib/campaign/PartyList.svelte'
  import PartyWizard from '#lib/character/PartyWizard.svelte'
  import Alert from '#lib/ui/Alert.svelte'
  import Button from '#lib/ui/Button.svelte'
  import Link from '#lib/ui/Link.svelte'
  import Panel from '#lib/ui/Panel.svelte'
  import type { PageProps } from './$types'

  let { data, form }: PageProps = $props()

  const seedHref = $derived(resolve('/campaigns/[id]', { id: data.campaign.id }))
  const partyHref = $derived(resolve('/campaigns/[id]/party', { id: data.campaign.id }))
  const archived = $derived(data.campaign.status === 'archived')
  const openId = $derived(
    data.open
      ? 'draft' in data.open.target
        ? data.open.target.draft
        : data.open.target.character
      : null
  )
</script>

<svelte:head><title>Party · {data.campaign.name}</title></svelte:head>

<main class="mx-auto max-w-7xl space-y-6 p-6">
  <Link href={resolve('/campaigns')} class="text-sm">All Campaigns</Link>
  <header class="space-y-1">
    <div class="flex items-center gap-3">
      <h1 class="font-display text-2xl">{data.campaign.name}</h1>
      {#if data.campaign.status !== 'missing'}
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
      current="Party"
      hrefs={{ Seed: seedHref, Party: partyHref }}
      unavailable={['Begin']}
    />

    {#if archived}
      <Alert variant="warning">This Campaign is archived. Restore it to change it.</Alert>
    {/if}

    <Panel title="Party">
      <div class="space-y-3">
        <PartyList campaignId={data.campaign.id} members={data.members} selected={openId} />
        {#if form?.error}<Alert variant="danger">{form.error}</Alert>{/if}
        {#if !archived}
          <form method="POST" action="?/newDraft" use:enhance>
            <Button type="submit">New Character</Button>
          </form>
        {/if}
      </div>
    </Panel>

    {#if data.open && !archived}
      {#key openId}
        <PartyWizard
          rules={data.open.rules}
          draft={data.open.draft}
          step={data.open.step}
          target={data.open.target}
          backHref={partyHref}
        />
      {/key}
    {/if}
  {/if}
</main>
