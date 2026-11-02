<script lang="ts">
  import ContextMeter from './ContextMeter.svelte'
  import { DEFAULT_CONTEXT_LIMIT, estimatePromptTokens, KEEP_MESSAGES } from './context.ts'
  import {
    acceptCard,
    applyCompaction,
    dismissCard,
    dismissedNotes,
    emptyConversation,
    failMessage,
    historyOf,
    pendingProposals,
    receiveTurn,
    retryMessage,
    sendMessage
  } from './proposals.ts'
  import { FIELD_LABELS, type Seed, type SeedField } from './seed.ts'
  import type { Compaction, TurnFailure, TurnResult } from '#lib/server/ai/world-conversation.ts'

  type Props = {
    /** The live seed card values, read when a turn is sent. */
    seed: Seed
    /** Called when the user accepts a card: the only way the chat changes the seed card. */
    onaccept: (field: SeedField, value: string) => void
    /** True when AI controls must be off (a reasoning model was detected). */
    disabled?: boolean
    /** Called when a turn shows the model is a reasoning model. */
    onreasoningmodel?: () => void
    /** The loaded model's context length; null when LM Studio did not report it. */
    contextLength?: number | null
    /** The configured limit, estimated against, when `contextLength` is null. */
    fallbackContextLength?: number
  }

  let {
    seed,
    onaccept,
    disabled = false,
    onreasoningmodel,
    contextLength = null,
    fallbackContextLength = DEFAULT_CONTEXT_LIMIT
  }: Props = $props()

  const limit = $derived(contextLength ?? fallbackContextLength)

  // The transcript lives only in this component: never stored, gone on reload or reset.
  let conversation = $state(emptyConversation())
  let draft = $state('')
  let busy = $state(false)
  let inflight: AbortController | null = null
  /** Why input is blocked (the conversation cannot fit the context), or null. */
  let blocked = $state<string | null>(null)
  /** The user chose to finish on the seed card: the chat stays readable but closed. */
  let finished = $state(false)
  let notice = $state<string | null>(null)

  const history = $derived(historyOf(conversation))
  const estimatedUsed = $derived(
    estimatePromptTokens({
      seed,
      history,
      summary: conversation.summary,
      summarizedCount: conversation.summarizedCount,
      dismissed: dismissedNotes(conversation),
      pending: pendingProposals(conversation)
    })
  )
  const used = $derived(conversation.lastUsedTokens ?? estimatedUsed)
  const canCompact = $derived(history.length - KEEP_MESSAGES > conversation.summarizedCount)
  const locked = $derived(disabled || blocked !== null || finished)

  function contextPayload() {
    return {
      summary: conversation.summary ?? undefined,
      summarizedCount: conversation.summarizedCount,
      context: { limit, lastUsedTokens: conversation.lastUsedTokens ?? undefined }
    }
  }

  const FAILURE_TEXT: Record<string, string> = {
    timeout: 'The assistant took too long to reply.',
    cancelled: 'Stopped before the assistant replied.'
  }

  async function send(message: string) {
    if (!message || busy || locked) return
    busy = true
    notice = null
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
          pending: pendingProposals(conversation),
          ...contextPayload(),
          message
        })
      })
      const result = (await response.json().catch(() => null)) as TurnResult | null
      if (result && 'ok' in result && result.ok) {
        // A compaction rewrites only what the model sees; the transcript keeps everything.
        const compacted = result.compaction
          ? applyCompaction(conversation, result.compaction)
          : conversation
        conversation = receiveTurn(
          sendMessage(compacted, message),
          result.reply,
          result.proposals,
          result.usage?.totalTokens
        )
        draft = ''
      } else if (result && 'ok' in result && !result.ok && result.failure.kind === 'context-full') {
        // Nothing was sent: keep the draft and block input until the user picks an exit.
        blocked = result.failure.message
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

  async function compactNow() {
    if (busy || locked || !canCompact) return
    busy = true
    notice = null
    const controller = (inflight = new AbortController())
    try {
      const response = await fetch('/api/world-creation/compact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          seed: $state.snapshot(seed),
          history,
          dismissed: dismissedNotes(conversation),
          pending: pendingProposals(conversation),
          ...contextPayload()
        })
      })
      const result = (await response.json().catch(() => null)) as
        ({ ok: true } & Compaction) | { ok: false; failure: TurnFailure } | null
      if (result?.ok) {
        conversation = applyCompaction(conversation, result)
      } else if (result && !result.ok && result.failure.kind === 'context-full') {
        blocked = result.failure.message
      } else {
        notice = 'Compaction did not finish. Try again.'
      }
    } catch {
      notice = controller.signal.aborted
        ? 'Compaction stopped.'
        : 'Compaction did not finish. Try again.'
    } finally {
      busy = false
      inflight = null
    }
  }

  function clearChat() {
    conversation = emptyConversation()
    blocked = null
    draft = ''
    notice = null
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
              disabled={busy || locked}
              onclick={() => retry(entry.id)}>Retry</button
            >
          </p>
        {/if}
        {#if entry.turn !== undefined}
          {@const cards = conversation.cards.filter((c) => c.turn === entry.turn)}
          {#if cards.length > 0}
            <ul aria-label="Proposals" class="mt-1 space-y-1">
              {#each cards as card (card.id)}
                {#if card.status === 'superseded'}
                  <li class="px-2 text-sm text-slate-500">
                    <span class="line-through">{FIELD_LABELS[card.field]}: {card.value}</span>
                    (superseded)
                  </li>
                {:else}
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
                {/if}
              {/each}
            </ul>
          {/if}
        {/if}
      </li>
      {#if conversation.dividers.includes(entry.id)}
        <li role="separator" class="border-t border-dashed pt-1 text-center text-xs text-slate-500">
          Earlier messages above were summarized for the assistant
        </li>
      {/if}
    {/each}
  </ol>

  {#if !disabled}
    <ContextMeter {used} {limit} estimated={conversation.lastUsedTokens === null} />
  {/if}

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
        disabled={busy || locked}
        rows="2"
        class="w-full rounded border p-2 disabled:opacity-50"></textarea>
    </label>
    <button
      type="submit"
      disabled={busy || locked || !draft.trim()}
      class="rounded bg-slate-800 px-3 py-1 text-white disabled:opacity-50"
    >
      Send
    </button>
    <button
      type="button"
      disabled={busy || locked || !canCompact}
      onclick={compactNow}
      class="rounded border px-3 py-1 disabled:opacity-50"
    >
      Compact now
    </button>
  </form>

  {#if notice}
    <p role="status" class="text-sm text-slate-600">{notice}</p>
  {/if}

  {#if blocked !== null}
    <div role="alert" class="space-y-1 rounded border border-red-200 bg-red-50 p-2 text-sm">
      <p>{blocked}. The chat is paused.</p>
      <button
        type="button"
        class="rounded border bg-white px-2 py-0.5"
        onclick={() => ((finished = true), (blocked = null))}>Finish on the seed card</button
      >
      <button type="button" class="rounded border bg-white px-2 py-0.5" onclick={clearChat}
        >Clear chat</button
      >
    </div>
  {/if}

  {#if finished}
    <p role="status" class="text-sm text-slate-600">
      The chat is closed. Finish your World on the seed card.
    </p>
  {/if}
</div>
