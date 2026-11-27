<script lang="ts">
  import { enhance } from '$app/forms'
  import { resolve } from '$app/paths'
  import CreationStepper from '#lib/campaign/CreationStepper.svelte'
  import DmBadge from '#lib/campaign/DmBadge.svelte'
  import CreationPage from '#lib/creation/CreationPage.svelte'
  import { createSessionsQuery } from '#lib/live/client.ts'
  import Journal from '#lib/play/Journal.svelte'
  import { createJournalQuery, createTimelineQuery } from '#lib/play/floor-client.ts'
  import Alert from '#lib/ui/Alert.svelte'
  import Button from '#lib/ui/Button.svelte'
  import Link from '#lib/ui/Link.svelte'
  import Panel from '#lib/ui/Panel.svelte'

  let { data, form } = $props()

  const sessions = createSessionsQuery(() => data.attached)
  const journal = createJournalQuery(
    () => data.campaign.id,
    () => data.journal
  )
  const timeline = createTimelineQuery(
    () => data.campaign.id,
    () => data.timeline
  )

  const archived = $derived(data.campaign.status === 'archived')
  const attached = $derived(sessions.data.includes(data.campaign.id))
  const state = $derived(data.creation.state)
  const begun = $derived(state === 'begun')
  // The Player's timeline starts with the first Narration after Begin: once it has one, play is open.
  const playing = $derived(timeline.data.entries.some((e) => e.type === 'narration'))

  const seedHref = $derived(resolve('/campaigns/[id]', { id: data.campaign.id }))
  const partyHref = $derived(resolve('/campaigns/[id]/party', { id: data.campaign.id }))
  const playHref = $derived(resolve('/campaigns/[id]/play', { id: data.campaign.id }))
  const beginHref = $derived(resolve('/campaigns/[id]/begin', { id: data.campaign.id }))
</script>

<svelte:head><title>{data.campaign.name} · Begin</title></svelte:head>

<CreationPage
  width="narrow"
  pane={{
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
      <DmBadge {attached} />
      <Link href={playHref} class="ml-auto text-sm">Play console</Link>
    </div>
    <p class="text-xs text-muted">{data.campaign.path}</p>
  </header>

  <CreationStepper current="Begin" hrefs={{ Seed: seedHref, Party: partyHref, Begin: beginHref }} />

  {#if archived}
    <Alert variant="warning">This Campaign is archived. Restore it to change it.</Alert>
  {/if}

  <Panel title="Begin">
    <div class="space-y-3 text-sm">
      <p>
        Begin starts the story. The DM builds the World and the story's plan from your Seed and your
        Characters' backstories. You see only a short, spoiler-free pitch: what your Characters know
        as the story opens. Then play opens.
      </p>
      <p>
        Once you Begin, the Seed is locked, so the World stays true to it. If you don't like the
        pitch, Start over throws the World and the plan away and unlocks the Seed. You can Start
        over until the DM's first Narration of play.
      </p>
    </div>
  </Panel>

  {#if form && 'error' in form && form.error}
    <Alert variant="danger">{form.error}</Alert>
  {/if}

  {#if !begun}
    <div class="space-y-2">
      {#if state === 'seed_incomplete'}
        <p class="text-sm text-muted">
          Complete the <Link href={seedHref}>Seed</Link> first: {data.creation.missing.join(', ')}.
        </p>
      {:else if state === 'party_empty'}
        <p class="text-sm text-muted">
          Save at least one Character to the <Link href={partyHref}>Party</Link> first.
        </p>
      {:else if !attached}
        <p class="text-sm text-muted">
          {#if data.isHost}
            The DM is away. Run <code>dm</code> in {data.campaign.path} to Begin.
          {:else}
            Waiting for the Host to start the DM.
          {/if}
        </p>
      {/if}
      {#if data.isHost}
        <form method="POST" action="?/begin" use:enhance>
          <Button type="submit" disabled={state !== 'ready' || !attached || archived}>Begin</Button>
        </form>
      {:else}
        <p class="text-sm text-muted">The Host begins the story.</p>
      {/if}
    </div>
  {:else}
    <Panel title="The pitch">
      {#if journal.data.entries.length === 0}
        <p class="text-sm text-muted" role="status">The DM is building the World…</p>
      {:else}
        <Journal entries={journal.data.entries} />
      {/if}
    </Panel>
    <div class="flex items-center gap-3">
      {#if playing}
        <Link href={playHref}>Play has opened: go to the play console</Link>
      {:else if !archived && data.isHost}
        <form method="POST" action="?/startOver" use:enhance>
          <Button type="submit" variant="secondary">Start over</Button>
        </form>
      {/if}
    </div>
  {/if}
</CreationPage>
