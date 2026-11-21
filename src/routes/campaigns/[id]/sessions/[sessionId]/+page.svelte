<script lang="ts">
  import { enhance } from '$app/forms'
  import { invalidateAll } from '$app/navigation'
  import { resolve } from '$app/paths'
  import SceneStatePanel from '#lib/session/SceneStatePanel.svelte'
  import StoryLog from '#lib/session/StoryLog.svelte'
  import EventInspector from '#lib/session/EventInspector.svelte'
  import Journal from '#lib/session/Journal.svelte'
  import Previously from '#lib/session/Previously.svelte'
  import type { ExchangeEvent, RulingMessage, RunStats } from '#lib/session/exchange-events.ts'
  import { answerCall, sendDeclaration } from '#lib/session/play.ts'
  import DeclarationForm from '#lib/session/DeclarationForm.svelte'
  import type { CallAnswer, CarriedEffect } from '#lib/session/call.ts'
  import type { SessionEvent } from '#lib/session/enums.ts'
  import Alert from '#lib/ui/Alert.svelte'
  import Button from '#lib/ui/Button.svelte'
  import Dialog from '#lib/ui/Dialog.svelte'
  import Link from '#lib/ui/Link.svelte'

  // The event inspector is for development only.
  const dev = import.meta.env.DEV

  let { data } = $props()

  let draft = $state('')
  let busy = $state(false)
  let journalOpen = $state(false)
  let problem = $state<string | null>(null)
  // Events streamed in this page visit, on top of what the load returned.
  let streamed = $state<SessionEvent[]>([])
  // The in-flight narration, shown until it is saved (then it arrives as an event) or discarded.
  let live = $state('')
  let liveNpcId = $state<string | null>(null)
  let thinking = $state(false)
  // Event inspector data for the latest Exchange (development only).
  let ruling = $state<RulingMessage | null>(null)
  let stats = $state<RunStats | null>(null)
  let controller: AbortController | null = null

  const events = $derived(
    data.events.concat(streamed.filter((s) => !data.events.some((e) => e.id === s.id)))
  )
  const ended = $derived(data.session.endedAt !== null)

  function onMessage(message: ExchangeEvent) {
    if (message.type === 'thinking') thinking = true
    else if (message.type === 'delta') {
      thinking = false
      live += message.text
      liveNpcId = message.npcId ?? null
    } else if (message.type === 'ruling') ruling = message
    else if (message.type === 'stats') stats = message.stats
    else if (message.type === 'discard') live = ''
    else if (message.type === 'event') {
      thinking = false
      live = ''
      streamed.push(message.event)
      // Code changed the Scene: reload it now so the panel updates before the Exchange ends.
      if (message.event.kind === 'scene-changed') void invalidateAll()
    } else if (message.type === 'done') {
      thinking = false
      live = ''
      if (message.reason === 'error') problem = message.message ?? 'Something went wrong.'
    }
  }

  /** Runs one Exchange and refreshes the page data after it. */
  /**
   * Streams one Exchange. `sent` runs once it ended without a problem, before the input is enabled
   * again, so clearing the draft there never wipes what the player types next.
   */
  async function stream(
    start: (signal: AbortSignal) => Promise<string | null>,
    sent?: () => void
  ): Promise<void> {
    busy = true
    problem = null
    controller = new AbortController()
    ruling = null
    stats = null
    let ok = false
    try {
      // A refusal comes back here; an Exchange that ended in error has already set `problem`.
      const refused = await start(controller.signal)
      if (refused) problem = refused
      ok = !problem
    } catch {
      // Stop aborts the request; anything else is a failed send.
      if (!controller.signal.aborted) problem = 'That Declaration could not be sent.'
      else ok = true
    } finally {
      thinking = false
      live = ''
      controller = null
      try {
        await invalidateAll()
      } finally {
        streamed = []
        if (ok) sent?.()
        busy = false
      }
    }
  }

  // Sending while a Call is open withdraws it (the runner does that) and starts a new Exchange.
  async function send(text: string) {
    if (busy) return
    await stream(
      (signal) => sendDeclaration(data.session.id, text, onMessage, signal),
      () => (draft = '')
    )
  }

  // A clicked exit or NPC declares at once, carrying its Effect; the draft is left as it was.
  function declare(text: string, effect: CarriedEffect) {
    if (busy) return
    void stream((signal) => sendDeclaration(data.session.id, text, onMessage, signal, effect))
  }

  function answer(given: CallAnswer, sent?: () => void): Promise<void> {
    if (busy) return Promise.resolve()
    return stream((signal) => answerCall(data.session.id, given, onMessage, signal), sent)
  }

  const roll = () => void answer({ kind: 'roll' })

  // Typing while a question is open answers it ("Answer"); "Do something else" sends instead.
  async function answerText(text: string) {
    await answer({ kind: 'text', text }, () => (draft = ''))
  }
</script>

<svelte:head><title>Session {data.session.number} · {data.campaign.name}</title></svelte:head>

<main class="mx-auto flex max-w-6xl flex-col gap-3 p-4">
  <header class="flex flex-wrap items-baseline justify-between gap-2">
    <div>
      <Link href={resolve('/campaigns/[id]', { id: data.campaign.id })} class="text-sm"
        >{data.campaign.name}</Link
      >
      <h1 class="font-display text-2xl">Session {data.session.number}</h1>
      <p class="text-sm text-muted">Playing as {data.character.name}</p>
    </div>
    <div class="flex items-center gap-2">
      <Button type="button" variant="secondary" onclick={() => (journalOpen = true)}>Journal</Button
      >
      {#if !ended}
        <form method="POST" action="?/end" use:enhance>
          <Button type="submit" variant="secondary">End Session</Button>
        </form>
      {/if}
    </div>
  </header>

  <Dialog
    bind:open={journalOpen}
    title="Journal"
    closeHref={resolve('/campaigns/[id]/sessions/[sessionId]', {
      id: data.campaign.id,
      sessionId: data.session.id
    })}
  >
    <Journal journal={data.journal} />
  </Dialog>

  {#if ended}
    <Alert variant="info">Session ended. This log is read-only.</Alert>
  {/if}

  <!-- Gone once the player acts: the load only returns it while the log is empty. -->
  {#if data.recap && events.length === 0}
    <Previously recap={data.recap} />
  {/if}

  <!-- Scene state | story log | event inspector (development only). -->
  <div
    class={[
      'grid grid-cols-1 gap-3',
      dev ? 'lg:grid-cols-[18rem_1fr_20rem]' : 'lg:grid-cols-[18rem_1fr]'
    ]}
  >
    <SceneStatePanel
      scene={data.scene}
      log={events}
      onpick={!ended && !busy ? (text) => (draft = text) : undefined}
      ondeclare={!ended && !busy ? declare : undefined}
    />

    <section aria-label="Story" class="flex min-h-96 flex-col gap-3">
      <div class="flex-1 rounded-panel border border-border bg-surface p-3">
        {#if events.length === 0 && !busy}
          <p class="text-muted">Nothing has happened yet. What do you do?</p>
        {:else}
          <StoryLog
            {events}
            npcs={[...data.scene.npcs, ...data.speakers]}
            {live}
            {liveNpcId}
            {thinking}
            mode={data.scene.mode}
            openCall={data.scene.openCall}
            onroll={!ended && !busy ? roll : undefined}
            onanswer={!ended && !busy ? (given) => void answer(given) : undefined}
          />
        {/if}
      </div>

      {#if problem}
        <Alert variant="danger">{problem}</Alert>
      {/if}
      {#if !ended}
        <DeclarationForm
          bind:draft
          {busy}
          callOpen={data.scene.openCall !== null}
          question={data.scene.openCall?.kind === 'question'}
          onsend={send}
          onanswer={answerText}
          onstop={() => controller?.abort()}
        />
      {/if}
    </section>

    {#if dev}
      <EventInspector
        {ruling}
        {stats}
        memory={data.memory}
        onrefresh={() => void invalidateAll()}
      />
    {/if}
  </div>
</main>
