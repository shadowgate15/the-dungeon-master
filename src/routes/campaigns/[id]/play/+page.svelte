<script lang="ts">
  import { resolve } from '$app/paths'
  import DmBadge from '#lib/campaign/DmBadge.svelte'
  import { createSessionsQuery } from '#lib/live/client.ts'
  import CharacterSheet from '#lib/play/CharacterSheet.svelte'
  import FloorComposer from '#lib/play/FloorComposer.svelte'
  import Timeline from '#lib/play/Timeline.svelte'
  import {
    createFloorQuery,
    createTimelineQuery,
    floorActions,
    FloorChangeError
  } from '#lib/play/floor-client.ts'
  import Alert from '#lib/ui/Alert.svelte'
  import Link from '#lib/ui/Link.svelte'

  let { data } = $props()

  const sessions = createSessionsQuery(() => data.attached)
  const floor = createFloorQuery(
    () => data.campaign.id,
    () => data.floor
  )
  const timeline = createTimelineQuery(
    () => data.campaign.id,
    () => data.timeline
  )
  const actions = floorActions(() => data.campaign.id)

  /** Done, sending the composer's text first for Send & Done. */
  function done(text: string | null) {
    attempt(async () => {
      if (text && acting) await actions.send(acting.id, text)
      await actions.done()
    })
  }

  // The selected sheet tab is the acting Character: the first who can act, until the Player picks.
  let picked = $state<string | null>(null)
  const actors = $derived(data.sheets.filter((s) => s.canAct))
  const acting = $derived(actors.find((s) => s.id === picked) ?? actors[0] ?? null)
  const archived = $derived(data.campaign.status === 'archived')

  let problem = $state<string | null>(null)
  async function attempt(change: () => Promise<unknown>) {
    problem = null
    try {
      await change()
    } catch (e) {
      if (e instanceof FloorChangeError) problem = e.message
      else throw e
    }
  }
</script>

<svelte:head><title>{data.campaign.name} · Play</title></svelte:head>

<div class="flex h-[calc(100dvh-3rem)] flex-col gap-2 overflow-hidden p-3">
  <header class="flex shrink-0 items-center gap-3">
    <Link href={resolve('/campaigns/[id]', { id: data.campaign.id })} class="text-sm"
      >{data.campaign.name}</Link
    >
    <DmBadge size="sm" attached={sessions.data.includes(data.campaign.id)} />
  </header>

  <main
    class="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[20rem_minmax(0,1fr)_15rem]"
    aria-label="Play console"
  >
    <CharacterSheet
      sheets={data.sheets}
      acting={acting?.id ?? null}
      onselect={(id) => (picked = id)}
    />

    <section aria-label="Story" class="flex min-h-0 flex-col gap-2">
      <Timeline entries={timeline.data.entries} awaitingSince={timeline.data.awaitingSince} />
      {#if problem}<Alert variant="danger">{problem}</Alert>{/if}
      {#if archived}
        <Alert variant="warning">This Campaign is archived. Restore it to play.</Alert>
      {:else}
        <FloorComposer
          acting={acting?.name ?? null}
          declarations={floor.data.declarations}
          awaiting={timeline.data.awaitingSince !== null}
          onsend={(text) => acting && attempt(() => actions.send(acting.id, text))}
          ondone={done}
          onedit={(id, text) => attempt(() => actions.edit(id, text))}
          onwithdraw={(id) => attempt(() => actions.withdraw(id))}
        />
      {/if}
    </section>

    <aside aria-label="Scene" class="flex min-h-0 flex-col gap-3 overflow-y-auto text-sm">
      <section class="rounded-panel border border-border bg-surface p-3">
        <h2 class="mb-1 text-xs font-semibold text-muted uppercase">Clock and Scene</h2>
        <p class="text-muted">The Scene is set once play begins.</p>
      </section>
      <section class="rounded-panel border border-border bg-surface p-3">
        <h2 class="mb-1 text-xs font-semibold text-muted uppercase">
          What {acting?.name ?? 'the Party'} knows
        </h2>
        <p class="text-muted">Nothing yet.</p>
      </section>
    </aside>
  </main>
</div>
