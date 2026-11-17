<script lang="ts">
  import { enhance } from '$app/forms'
  import { invalidateAll } from '$app/navigation'
  import { resolve } from '$app/paths'
  import SceneStatePanel from '#lib/session/SceneStatePanel.svelte'
  import StoryLog from '#lib/session/StoryLog.svelte'
  import { sendAction } from '#lib/session/play.ts'
  import type { SessionEvent } from '#lib/session/enums.ts'
  import Alert from '#lib/ui/Alert.svelte'
  import Button from '#lib/ui/Button.svelte'
  import Link from '#lib/ui/Link.svelte'
  import Textarea from '#lib/ui/Textarea.svelte'

  let { data } = $props()

  let draft = $state('')
  let busy = $state(false)
  let problem = $state<string | null>(null)
  // Events streamed in this page visit, on top of what the load returned.
  let streamed = $state<SessionEvent[]>([])

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
    try {
      problem = await sendAction(data.session.id, text, (message) => {
        if (message.type === 'event') streamed.push(message.event)
        if (message.type === 'done' && message.reason === 'error') {
          problem = message.message ?? 'Something went wrong.'
        }
      })
      if (!problem) draft = ''
    } catch {
      problem = 'That action could not be sent.'
    } finally {
      busy = false
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

  <!-- Three columns once the event inspector lands; scene state | story log | inspector. -->
  <div class="grid grid-cols-1 gap-3 lg:grid-cols-[18rem_1fr]">
    <SceneStatePanel scene={data.scene} />

    <section aria-label="Story" class="flex min-h-96 flex-col gap-3">
      <div class="flex-1 rounded-panel border border-border bg-surface p-3">
        {#if events.length === 0}
          <p class="text-muted">Nothing has happened yet. What do you do?</p>
        {:else}
          <StoryLog {events} npcs={data.scene.npcs} />
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
          <Button type="submit" disabled={busy || rollPending || !draft.trim()}>Send</Button>
        </form>
      {/if}
    </section>
  </div>
</main>
