<script lang="ts">
  import {
    acceptCard,
    dismissCard,
    dismissedNotes,
    emptyConversation,
    failMessage,
    historyOf,
    receiveTurn,
    retryMessage,
    sendMessage
  } from './proposals.ts'
  import { FIELD_LABELS, type Seed, type SeedField } from './seed.ts'
  import type { TurnFailure, TurnResult } from '#lib/server/ai/world-conversation.ts'

  type Props = {
    /** The live seed card values, read when a turn is sent. */
    seed: Seed
    /** Called when the user accepts a card: the only way the chat changes the seed card. */
    onaccept: (field: SeedField, value: string) => void
    /** True when AI controls must be off (a reasoning model was detected). */
    disabled?: boolean
    /** Called when a turn shows the model is a reasoning model. */
    onreasoningmodel?: () => void
  }

  let { seed, onaccept, disabled = false, onreasoningmodel }: Props = $props()

  // The transcript lives only in this component: never stored, gone on reload or reset.
  let conversation = $state(emptyConversation())
  let draft = $state('')
  let busy = $state(false)
  let inflight: AbortController | null = null

  const FAILURE_TEXT: Record<string, string> = {
    timeout: 'The assistant took too long to reply.',
    cancelled: 'Stopped before the assistant replied.'
  }

  async function send(message: string) {
    if (!message || busy || disabled) return
    busy = true
    const controller = (inflight = new AbortController())
    let failure: TurnFailure | null = null
    try {
      const response = await fetch('/api/world-creation/turn', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          seed: $state.snapshot(seed),
          history: historyOf(conversation),
          dismissed: dismissedNotes(conversation),
          message
        })
      })
      const result = (await response.json().catch(() => null)) as TurnResult | null
      if (result && 'ok' in result && result.ok) {
        conversation = receiveTurn(
          sendMessage(conversation, message),
          result.reply,
          result.proposals
        )
        draft = ''
      } else {
        failure = result && 'ok' in result && !result.ok ? result.failure : null
        conversation = failMessage(conversation, message, failureText(failure))
        draft = ''
      }
    } catch {
      // A dropped request is either Stop or a network failure; both are failed turns.
      const kind = controller.signal.aborted ? 'cancelled' : 'provider-error'
      failure = { kind, message: '' }
      conversation = failMessage(conversation, message, failureText(failure))
      draft = ''
    } finally {
      busy = false
      inflight = null
    }
    if (failure?.kind === 'reasoning-model') onreasoningmodel?.()
  }

  function failureText(failure: TurnFailure | null) {
    if (failure?.kind === 'reasoning-model') return failure.message
    return (failure && FAILURE_TEXT[failure.kind]) ?? 'The assistant could not reply.'
  }

  function retry(id: string) {
    const { state, message } = retryMessage(conversation, id)
    if (message === null) return
    conversation = state
    void send(message)
  }

  function stop() {
    inflight?.abort()
  }

  function accept(id: string) {
    const { state, write } = acceptCard(conversation, id)
    conversation = state
    if (write) onaccept(write.field, write.value)
  }
</script>

<div class="space-y-2">
  <ol aria-label="Conversation" class="space-y-2">
    {#each conversation.entries as entry (entry.id)}
      <li class={entry.role === 'user' ? 'text-right' : ''}>
        <p
          class={[
            'inline-block rounded px-2 py-1',
            entry.error === undefined ? 'bg-slate-100' : 'bg-red-50 text-slate-500'
          ]}
        >
          {entry.content}
        </p>
        {#if entry.error !== undefined}
          <p role="alert" class="text-sm text-red-600">
            Failed: {entry.error}
            <button
              type="button"
              class="rounded border px-2 py-0.5 text-slate-800 disabled:opacity-50"
              disabled={busy || disabled}
              onclick={() => retry(entry.id)}>Retry</button
            >
          </p>
        {/if}
        {#if entry.turn !== undefined}
          {@const cards = conversation.cards.filter((c) => c.turn === entry.turn)}
          {#if cards.length > 0}
            <ul aria-label="Proposals" class="mt-1 space-y-1">
              {#each cards as card (card.id)}
                <li class="flex items-center gap-2 rounded border border-violet-200 p-2 text-sm">
                  <span class="flex-1"
                    ><strong>{FIELD_LABELS[card.field]}:</strong> {card.value}</span
                  >
                  {#if card.status === 'pending'}
                    <button
                      type="button"
                      class="rounded bg-green-700 px-2 py-0.5 text-white"
                      onclick={() => accept(card.id)}>Accept</button
                    >
                    <button
                      type="button"
                      class="rounded border px-2 py-0.5"
                      onclick={() => (conversation = dismissCard(conversation, card.id))}
                      >Dismiss</button
                    >
                  {:else}
                    <span class="text-slate-500 capitalize">{card.status}</span>
                  {/if}
                </li>
              {/each}
            </ul>
          {/if}
        {/if}
      </li>
    {/each}
  </ol>

  {#if busy}
    <p role="status" class="text-slate-500">
      Thinking…
      <button type="button" class="rounded border px-2 py-0.5 text-slate-800" onclick={stop}
        >Stop</button
      >
    </p>
  {/if}

  <form
    onsubmit={(event) => {
      event.preventDefault()
      void send(draft.trim())
    }}
    class="space-y-1"
  >
    <label class="block">
      <span class="block text-sm font-medium">Message</span>
      <textarea
        bind:value={draft}
        disabled={busy || disabled}
        rows="2"
        class="w-full rounded border p-2 disabled:opacity-50"></textarea>
    </label>
    <button
      type="submit"
      disabled={busy || disabled || !draft.trim()}
      class="rounded bg-slate-800 px-3 py-1 text-white disabled:opacity-50"
    >
      Send
    </button>
  </form>
</div>
