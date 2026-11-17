<script lang="ts">
  import { enhance } from '$app/forms'
  import { invalidateAll } from '$app/navigation'
  import { resolve } from '$app/paths'
  import SceneStatePanel from '#lib/session/SceneStatePanel.svelte'
  import StoryLog from '#lib/session/StoryLog.svelte'
  import EventInspector from '#lib/session/EventInspector.svelte'
  import { sendAction, type RunStats, type StepMessage } from '#lib/session/play.ts'
  import type { SessionEvent } from '#lib/session/enums.ts'
  import Alert from '#lib/ui/Alert.svelte'
  import Button from '#lib/ui/Button.svelte'
  import Link from '#lib/ui/Link.svelte'
  import Textarea from '#lib/ui/Textarea.svelte'

  // The event inspector is for development only.
  const dev = import.meta.env.DEV

  let { data } = $props()

  let draft = $state('')
  let busy = $state(false)
  let problem = $state<string | null>(null)
  // Events streamed in this page visit, on top of what the load returned.
  let streamed = $state<SessionEvent[]>([])
  // The in-flight narration, shown until it is saved (then it arrives as an event) or discarded.
  let live = $state('')
  let liveNpcId = $state<string | null>(null)
  let thinking = $state(false)
  // Event inspector data for the latest run (development only).
  let steps = $state<StepMessage[]>([])
  let stats = $state<RunStats | null>(null)
  let controller: AbortController | null = null

  const events = $derived(
    data.events.concat(streamed.filter((s) => !data.events.some((e) => e.id === s.id)))
  )
  const ended = $derived(data.session.endedAt !== null)
  const rollPending = $derived(data.scene.pendingRoll !== null)

  async function send(e: SubmitEvent) {
    e.preventDefault()
    const text = draft.trim()
    if (!text || busy) return
    busy = true
    problem = null
    controller = new AbortController()
    steps = []
    stats = null
    try {
      problem = await sendAction(
        data.session.id,
        text,
        (message) => {
          if (message.type === 'thinking') thinking = true
          else if (message.type === 'delta') {
            thinking = false
            live += message.text
            liveNpcId = message.npcId ?? null
          } else if (message.type === 'step') steps.push(message)
          else if (message.type === 'stats') stats = message.stats
          else if (message.type === 'discard') live = ''
          else if (message.type === 'event') {
            thinking = false
            live = ''
            streamed.push(message.event)
            // Code changed the Scene: reload it now so the panel updates before the run ends.
            if (message.event.kind === 'scene-changed') void invalidateAll()
          } else if (message.type === 'done') {
            thinking = false
            live = ''
            if (message.reason === 'error') problem = message.message ?? 'Something went wrong.'
          }
        },
        controller.signal
      )
      if (!problem) draft = ''
    } catch {
      // Stop aborts the request; anything else is a failed send.
      if (!controller.signal.aborted) problem = 'That action could not be sent.'
      else draft = ''
    } finally {
      busy = false
      thinking = false
      live = ''
      controller = null
      await invalidateAll()
      streamed = []
    }
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
    {#if !ended}
      <form method="POST" action="?/end" use:enhance>
        <Button type="submit" variant="secondary">End Session</Button>
      </form>
    {/if}
  </header>

  {#if ended}
    <Alert variant="info">Session ended. This log is read-only.</Alert>
  {/if}

  <!-- Scene state | story log | event inspector (development only). -->
  <div
    class={[
      'grid grid-cols-1 gap-3',
      dev ? 'lg:grid-cols-[18rem_1fr_20rem]' : 'lg:grid-cols-[18rem_1fr]'
    ]}
  >
    <SceneStatePanel scene={data.scene} />

    <section aria-label="Story" class="flex min-h-96 flex-col gap-3">
      <div class="flex-1 rounded-panel border border-border bg-surface p-3">
        {#if events.length === 0 && !busy}
          <p class="text-muted">Nothing has happened yet. What do you do?</p>
        {:else}
          <StoryLog {events} npcs={data.scene.npcs} {live} {liveNpcId} {thinking} />
        {/if}
      </div>

      {#if problem}
        <Alert variant="danger">{problem}</Alert>
      {/if}
      {#if !ended}
        <form onsubmit={send} class="flex items-end gap-2">
          <label class="flex-1 text-sm">
            Your action
            <Textarea
              bind:value={draft}
              rows={2}
              disabled={busy || rollPending}
              placeholder={rollPending ? 'Roll first.' : 'What do you do?'}
            />
          </label>
          {#if busy}
            <Button type="button" variant="secondary" onclick={() => controller?.abort()}
              >Stop</Button
            >
          {:else}
            <Button type="submit" disabled={rollPending || !draft.trim()}>Send</Button>
          {/if}
        </form>
      {/if}
    </section>

    {#if dev}
      <EventInspector {steps} {stats} />
    {/if}
  </div>
</main>
