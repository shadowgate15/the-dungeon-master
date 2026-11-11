<script lang="ts">
  import { onMount } from 'svelte'
  import { enhance } from '$app/forms'
  import { invalidateAll, replaceState } from '$app/navigation'
  import { resolve } from '$app/paths'
  import { page } from '$app/state'
  import AiStatusChip from '#lib/ai/AiStatusChip.svelte'
  import { createAiStatus, unavailableReason } from '#lib/ai/ai-status.svelte.ts'
  import Alert from '#lib/ui/Alert.svelte'
  import Button from '#lib/ui/Button.svelte'
  import Link from '#lib/ui/Link.svelte'
  import CharacterSheetPanel from '#lib/session/CharacterSheetPanel.svelte'
  import PlayLayout from '#lib/session/PlayLayout.svelte'
  import RollPrompt from '#lib/session/RollPrompt.svelte'
  import { checkLabel, resultLabel } from '#lib/session/roll.ts'
  import Textarea from '#lib/ui/Textarea.svelte'
  import { deriveTurnState } from '#lib/session/lifecycle.ts'
  import { TurnStream } from '#lib/session/turn-stream.svelte.ts'

  let { data } = $props()

  const ended = $derived(data.session.endedAt !== null)
  const turnState = $derived(deriveTurnState(data.turns))
  const pendingRoll = $derived(data.turns.at(-1)?.rollRequest ?? null)

  const ai = createAiStatus()
  // Only model-calling actions (Send, Retry) are disabled while the model is down. The Roll click
  // and End are not: a roll is made and saved before any model call. An unanswered probe does not
  // disable anything, so a slow check never blocks play.
  const downReason = $derived(ai.status ? unavailableReason(ai.status) : undefined)

  const stream = new TurnStream(`/api/sessions/${page.params.sessionId}/turn`, async () => {
    await invalidateAll()
    // A failure may mean the model just went down: re-probe so the chip and reason are current.
    if (stream.error) void ai.check()
  })
  let action = $state('')

  // The resume recap: a stateless side call, not a Turn and not the generating state. Silent on
  // failure, and any submit aborts it.
  let recap = $state<string | null>(null)
  let recapController: AbortController | undefined

  function abortRecap() {
    recapController?.abort()
    recapController = undefined
    recap = null
  }

  async function loadRecap() {
    const controller = new AbortController()
    recapController = controller
    try {
      const response = await fetch(`/api/sessions/${page.params.sessionId}/recap`, {
        signal: controller.signal
      })
      const body = (await response.json()) as { recap: string | null }
      if (!controller.signal.aborted) recap = body.recap
    } catch {
      // Silent: a recap is a courtesy.
    }
  }

  async function send(event: SubmitEvent) {
    event.preventDefault()
    const text = action.trim()
    if (!text || stream.streaming || downReason) return
    action = ''
    abortRecap()
    await stream.start(text)
  }

  // Another window (or a Stop the server has not yet released) is mid-answer: poll until it is done.
  $effect(() => {
    if (!data.generating || stream.streaming) return
    const timer = setInterval(() => void invalidateAll(), 1000)
    return () => clearInterval(timer)
  })

  // Starting a Session lands here with ?opening: the DM speaks first. Reloading never re-asks.
  onMount(() => {
    if (page.url.searchParams.has('opening')) {
      replaceState(
        resolve('/campaigns/[id]/sessions/[sessionId]', {
          id: data.campaign.id,
          sessionId: data.session.id
        }),
        {}
      )
      if (!ended && turnState === 'unopened') void stream.start()
    } else if (!ended && !data.generating && turnState === 'awaiting-action') {
      void loadRecap()
    }
    return () => recapController?.abort()
  })
</script>

<svelte:head><title>{data.campaign.name}: Session {data.session.number}</title></svelte:head>

<main class="mx-auto max-w-6xl space-y-3 p-4 sm:p-6">
  <div class="flex items-center justify-between gap-2">
    <div>
      <Link href={resolve('/campaigns/[id]', { id: data.campaign.id })} class="text-sm"
        >{data.campaign.name}</Link
      >
      <h1 class="font-display text-xl">Session {data.session.number}</h1>
    </div>
    <div class="flex items-center gap-2">
      <AiStatusChip {ai} />
      {#if !ended}
        <form method="POST" action="?/end" use:enhance>
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            disabled={stream.streaming || data.generating}>End Session</Button
          >
        </form>
      {/if}
    </div>
  </div>

  <PlayLayout>
    {#snippet narrative()}
      {#if ended}
        <Alert variant="info">Session ended. This transcript is read-only.</Alert>
      {/if}
      <ol aria-label="Transcript" class="space-y-3">
        {#each data.turns as t, i (t.id)}
          <li
            class={t.author === 'dm'
              ? 'max-w-prose'
              : 'ml-auto max-w-prose rounded-control bg-raised p-2 text-right'}
          >
            <div class="text-xs text-muted uppercase">
              {t.author === 'dm' ? 'Dungeon Master' : 'You'}
            </div>
            {#if t.kind === 'roll_result' && t.rollResult}
              {@const asked = data.turns[i - 1]?.rollRequest}
              <p>
                {asked ? checkLabel(asked) : 'Check'}: {resultLabel(t.rollResult)}{asked
                  ? ` against DC ${asked.dc}`
                  : ''}
              </p>
            {:else if t.text}
              <p>{t.text}</p>
            {/if}
            {#if t.rollRequest}
              <p class="text-sm text-muted">
                The Dungeon Master asks for a {checkLabel(t.rollRequest)}, DC {t.rollRequest.dc}.
              </p>
            {/if}
          </li>
        {/each}
      </ol>
      {#if stream.pendingAction !== null}
        <div class="ml-auto max-w-prose rounded-control bg-raised p-2 text-right">
          <div class="text-xs text-muted uppercase">You</div>
          <p>{stream.pendingAction}</p>
        </div>
      {/if}
      {#if stream.streaming}
        <div class="max-w-prose" aria-live="polite" aria-label="DM is answering">
          <div class="text-xs text-muted uppercase">Dungeon Master</div>
          <p>{stream.text || 'The Dungeon Master is thinking...'}</p>
        </div>
      {/if}
      {#if recap}
        <aside aria-label="Recap" class="max-w-prose rounded-control bg-raised p-2 text-sm">
          <div class="text-xs text-muted uppercase">Previously</div>
          <p>{recap}</p>
        </aside>
      {/if}
      {#if data.turns.length === 0 && !stream.streaming}
        <p class="text-muted">Nothing has happened yet.</p>
      {/if}
    {/snippet}
    {#snippet footer()}
      {#if ended}
        <p class="px-2 py-1 text-sm text-muted">This Session has ended.</p>
      {:else if stream.streaming}
        <div class="flex items-center justify-between gap-2 px-2 py-1">
          <p class="text-sm text-muted">The Dungeon Master is answering...</p>
          <Button variant="secondary" size="sm" onclick={() => stream.stop()}>Stop</Button>
        </div>
      {:else if data.generating}
        <div class="flex items-center justify-between gap-2 px-2 py-1">
          <p class="text-sm text-muted">
            The Dungeon Master is answering in another window. This updates when it finishes.
          </p>
        </div>
      {:else if turnState === 'awaiting-action'}
        <form class="space-y-2" onsubmit={send}>
          {#if stream.error}
            <Alert variant="danger">{stream.error}</Alert>
          {/if}
          <Textarea
            aria-label="Your action"
            rows={2}
            placeholder="What do you do?"
            bind:value={action}
            onkeydown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                e.currentTarget.form?.requestSubmit()
              }
            }}
          />
          <div class="flex items-center justify-end gap-2">
            {#if downReason}<p class="text-sm text-muted">{downReason}</p>{/if}
            <Button type="submit" size="sm" disabled={action.trim() === '' || !!downReason}
              >Send</Button
            >
          </div>
        </form>
      {:else if turnState === 'pending-roll' && pendingRoll}
        <RollPrompt request={pendingRoll} onroll={() => stream.start(undefined, { roll: true })} />
      {:else}
        <div class="space-y-2">
          <Alert variant="danger">
            {stream.error ??
              (turnState === 'unopened'
                ? 'The Dungeon Master has not opened the scene yet.'
                : 'The Dungeon Master did not answer your action.')}
          </Alert>
          <div class="flex items-center justify-end gap-2">
            {#if downReason}<p class="text-sm text-muted">{downReason}</p>{/if}
            <Button size="sm" disabled={!!downReason} onclick={() => stream.start()}>Retry</Button>
          </div>
        </div>
      {/if}
    {/snippet}
    {#snippet sheet()}
      <CharacterSheetPanel model={data.sheet} />
    {/snippet}
  </PlayLayout>
</main>
