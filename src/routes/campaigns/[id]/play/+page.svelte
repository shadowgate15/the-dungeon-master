<script lang="ts">
  import { resolve } from '$app/paths'
  import DmBadge from '#lib/campaign/DmBadge.svelte'
  import { createSessionsQuery } from '#lib/live/client.ts'
  import CallCard from '#lib/play/CallCard.svelte'
  import CharacterSheet from '#lib/play/CharacterSheet.svelte'
  import FloorComposer from '#lib/play/FloorComposer.svelte'
  import Rail from '#lib/play/Rail.svelte'
  import { actingCharacter, turnOf } from '#lib/play/combat.ts'
  import { knownBy } from '#lib/play/journal.ts'
  import PermissionCard from '#lib/play/PermissionCard.svelte'
  import TakeASeat from '#lib/play/TakeASeat.svelte'
  import Timeline from '#lib/play/Timeline.svelte'
  import { createPermissionQuery, permissionActions } from '#lib/play/permission-client.ts'
  import {
    callActions,
    claimActions,
    createClaimsQuery,
    createFloorQuery,
    createSceneQuery,
    createSheetsQuery,
    createJournalQuery,
    createTimelineQuery,
    endSession,
    floorActions,
    PlayRequestError,
    levelUp,
    saveDetails
  } from '#lib/play/floor-client.ts'
  import Alert from '#lib/ui/Alert.svelte'
  import Button from '#lib/ui/Button.svelte'
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
  const scene = createSceneQuery(
    () => data.campaign.id,
    () => data.scene
  )
  const party = createSheetsQuery(
    () => data.campaign.id,
    () => data.sheets
  )
  const journal = createJournalQuery(
    () => data.campaign.id,
    () => data.journal
  )
  const claims = createClaimsQuery(
    () => data.campaign.id,
    () => data.claims
  )
  const seats = claimActions(() => data.campaign.id)
  // No Claim: the console waits, empty and dimmed, behind Take a seat.
  const seated = $derived(claims.data.some((r) => r.claim === 'yours'))
  let seatOpen = $state(false)
  $effect(() => {
    if (!seated) seatOpen = true
  })
  const actions = floorActions(() => data.campaign.id)
  const calls = callActions(() => data.campaign.id)
  let rolling = $state(false)

  /** Rolls or answers one part of the open Call, one click at a time. */
  function answerCall(change: () => Promise<unknown>) {
    rolling = true
    attempt(change).finally(() => (rolling = false))
  }

  const permission = createPermissionQuery(
    () => data.campaign.id,
    () => data.permission
  )
  const answers = permissionActions(() => data.campaign.id)

  /** Done, sending the composer's text first for Send & Done. */
  function done(text: string | null) {
    attempt(async () => {
      if (text && acting) await actions.send(acting.id, text)
      await actions.done()
    })
  }

  // The selected sheet tab is the acting Character: the first in the Scene who can act, until the
  // Player picks (or a Combat turn locks it).
  let picked = $state<string | null>(null)
  const inScene = $derived(new Set(scene.data.present.map((c) => c.id)))
  // A tab for a Character elsewhere shows where they are, by Place name.
  const sheets = $derived(
    party.data.map((s) => {
      const away = scene.data.elsewhere.find((c) => c.id === s.id)
      return { ...s, whereabouts: away ? (away.whereabouts ?? 'elsewhere') : null }
    })
  )
  const actors = $derived(sheets.filter((s) => s.canAct && inScene.has(s.id)))
  // In a Combat the composer is locked to whoever's turn it is, so picks wait.
  const acting = $derived(actingCharacter(actors, picked, scene.data.combat))
  const turn = $derived(turnOf(scene.data.combat))
  const archived = $derived(data.campaign.status === 'archived')
  const attached = $derived(sessions.data.includes(data.campaign.id))

  // Ending lasts until the DM leaves; the next Session starts with the button live again.
  let ending = $state(false)
  $effect(() => {
    if (!attached) ending = false
  })
  function end() {
    attempt(async () => {
      await endSession(data.campaign.id)
      ending = true
    })
  }

  let problem = $state<string | null>(null)
  async function attempt(change: () => Promise<unknown>) {
    problem = null
    try {
      await change()
    } catch (e) {
      if (e instanceof PlayRequestError) problem = e.message
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
    <DmBadge size="sm" {attached} />
    <Link
      href={resolve('/campaigns/[id]/journal', { id: data.campaign.id })}
      class="ml-auto text-sm">Journal and Session history</Link
    >
    <Button size="sm" variant="secondary" onclick={() => (seatOpen = true)}>Your Characters</Button>
    {#if data.isHost}
      <Button size="sm" variant="secondary" disabled={!attached || archived || ending} onclick={end}
        >{ending ? 'Ending the session…' : 'End Session'}</Button
      >
    {/if}
  </header>

  <main
    class={[
      'grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[20rem_minmax(0,1fr)_15rem]',
      !seated && 'pointer-events-none opacity-40'
    ]}
    aria-label="Play console"
    inert={!seated}
  >
    <CharacterSheet
      {sheets}
      acting={acting?.id ?? null}
      onselect={(id) => (picked = id)}
      onlevelup={archived
        ? undefined
        : (id, picks) => attempt(() => levelUp(data.campaign.id, id, picks))}
      onsavedetails={archived
        ? undefined
        : (id, details) => saveDetails(data.campaign.id, id, details)}
    />

    <section aria-label="Story" class="flex min-h-0 flex-col gap-2">
      <Timeline
        entries={seated ? timeline.data.entries : []}
        awaitingSince={timeline.data.awaitingSince}
        away={!attached}
      />
      {#if seated && timeline.data.call && !archived}
        {@const open = timeline.data.call}
        <CallCard
          call={open}
          disabled={rolling || !attached}
          onroll={(part) => answerCall(() => calls.roll(open.id, part))}
          onanswer={(part, answer) => answerCall(() => calls.answer(open.id, part, answer))}
        />
      {/if}
      {#if problem}<Alert variant="danger">{problem}</Alert>{/if}
      {#if data.isHost && permission.data}
        {@const request = permission.data}
        <PermissionCard
          {request}
          onanswer={(behavior) => answers.answer(request.requestId, behavior)}
        />
      {/if}
      {#if archived}
        <Alert variant="warning">This Campaign is archived. Restore it to play.</Alert>
      {:else}
        <FloorComposer
          acting={acting?.name ?? null}
          turn={turn?.name ?? null}
          declarations={seated ? floor.data.declarations : []}
          awaiting={timeline.data.awaitingSince !== null}
          onsend={(text) => acting && attempt(() => actions.send(acting.id, text))}
          ondone={done}
          onedit={(id, text) => attempt(() => actions.edit(id, text))}
          onwithdraw={(id) => attempt(() => actions.withdraw(id))}
          elsewhere={scene.data.elsewhere}
          oncut={(id) => attempt(() => actions.cut(id))}
          returned={seated ? floor.data.returned : []}
          onreturned={(ids) => attempt(() => actions.clearReturned(ids))}
          away={attached ? null : { folder: data.campaign.path }}
          isHost={data.isHost}
        />
      {/if}
    </section>

    <Rail
      scene={scene.data}
      believer={acting?.name ?? 'the Party'}
      entries={acting ? knownBy(journal.data, acting.id) : journal.data.entries}
      actor={acting?.id}
    />
  </main>

  <TakeASeat
    bind:open={seatOpen}
    rows={claims.data}
    createHref={resolve('/campaigns/[id]/party', { id: data.campaign.id })}
    closeHref={resolve('/campaigns/[id]', { id: data.campaign.id })}
    {problem}
    onclaim={(id) => attempt(() => seats.claim(id))}
    onletgo={(id) => attempt(() => seats.letGo(id))}
  />
</div>
