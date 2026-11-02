<script lang="ts">
  import {
    acceptCard,
    dismissCard,
    dismissedNotes,
    emptyConversation,
    historyOf,
    receiveTurn,
    sendMessage
  } from './proposals.ts'
  import { FIELD_LABELS, type Seed, type SeedField } from './seed.ts'
  import type { TurnResult } from '#lib/server/ai/world-conversation.ts'

  type Props = {
    /** The live seed card values, read when a turn is sent. */
    seed: Seed
    /** Called when the user accepts a card: the only way the chat changes the seed card. */
    onaccept: (field: SeedField, value: string) => void
  }

  let { seed, onaccept }: Props = $props()

  // The transcript lives only in this component: never stored, gone on reload or reset.
  let conversation = $state(emptyConversation())
  let draft = $state('')
  let busy = $state(false)
  let error = $state<string | null>(null)

  async function send() {
    const message = draft.trim()
    if (!message || busy) return
    busy = true
    error = null
    try {
      const response = await fetch('/api/world-creation/turn', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
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
        error = 'The assistant could not reply. Try again.'
      }
    } catch {
      error = 'The assistant could not reply. Try again.'
    } finally {
      busy = false
    }
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
        <p class="inline-block rounded bg-slate-100 px-2 py-1">{entry.content}</p>
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
    <p role="status" class="text-slate-500">Thinking…</p>
  {/if}
  {#if error}
    <p role="alert" class="text-sm text-red-600">{error}</p>
  {/if}

  <form
    onsubmit={(event) => {
      event.preventDefault()
      void send()
    }}
    class="space-y-1"
  >
    <label class="block">
      <span class="block text-sm font-medium">Message</span>
      <textarea
        bind:value={draft}
        disabled={busy}
        rows="2"
        class="w-full rounded border p-2 disabled:opacity-50"></textarea>
    </label>
    <button
      type="submit"
      disabled={busy || !draft.trim()}
      class="rounded bg-slate-800 px-3 py-1 text-white disabled:opacity-50"
    >
      Send
    </button>
  </form>
</div>
