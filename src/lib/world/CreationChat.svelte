<script lang="ts">
  import ContextMeter from './ContextMeter.svelte'
  import Alert from '#lib/ui/Alert.svelte'
  import Button from '#lib/ui/Button.svelte'
  import ChatBubble from '#lib/ui/ChatBubble.svelte'
  import Field from '#lib/ui/Field.svelte'
  import ProposalCard from '#lib/ui/ProposalCard.svelte'
  import Textarea from '#lib/ui/Textarea.svelte'
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
  import { FIELD_LABELS } from './seed.ts'
  import type { AiStatus } from '#lib/ai/status.ts'
  import type { Compaction, TurnFailure, TurnResult } from '#lib/server/ai/conversation-engine.ts'

  type Props = {
    /** The live seed card values, read when a turn is sent. */
    seed: Record<string, string>
    /** Called when the user accepts a card: the only way the chat changes the seed card. */
    onaccept: (field: string, value: string) => void
    /** The conversation endpoints' base path: `<endpoint>/turn` and `<endpoint>/compact`. */
    endpoint?: string
    /** Card labels by seed field. */
    labels?: Record<string, string>
    /** What is being created, as the player says it: "World" or "Campaign". */
    subject?: string
    /** Extra request body keys read when a turn is sent (a Campaign's selected `worldIds`). */
    extraBody?: Record<string, unknown>
    /** Server-built system prompts the client only estimates (a Campaign's Worlds' Seed text). */
    extraSystemPrompts?: string[]
    /** Called when a turn fails because the selected Worlds changed (Campaign only). */
    onworldschanged?: () => void
    /** Called with the fields of the still-pending cards whenever they change (Character rail dot). */
    onpending?: (fields: string[]) => void
    /** Renders a card's value for display (Character Roll cards); the raw value is still sent. */
    formatValue?: (field: string, value: string) => string
    /** True when AI controls must be off (a reasoning model was detected). */
    disabled?: boolean
    /** Called when a turn shows the model is a reasoning model. */
    onreasoningmodel?: () => void
    /** Called when the probe before a send found LM Studio down or the model missing. */
    onunavailable?: (status: AiStatus) => void
    /** The loaded model's context length; null when LM Studio did not report it. */
    contextLength?: number | null
    /** The configured limit, estimated against, when `contextLength` is null. */
    fallbackContextLength?: number
  }

  let {
    seed,
    onaccept,
    endpoint = '/api/world-creation',
    labels = FIELD_LABELS,
    subject = 'World',
    extraBody,
    extraSystemPrompts,
    onworldschanged,
    onpending,
    formatValue,
    disabled = false,
    onreasoningmodel,
    onunavailable,
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
      pending: pendingProposals(conversation),
      extraSystemPrompts
    })
  )
  const used = $derived(conversation.lastUsedTokens ?? estimatedUsed)
  const canCompact = $derived(history.length - KEEP_MESSAGES > conversation.summarizedCount)
  const locked = $derived(disabled || blocked !== null || finished)

  $effect(() => {
    onpending?.(pendingProposals(conversation).map((p) => p.field))
  })

  function contextPayload() {
    return {
      summary: conversation.summary ?? undefined,
      summarizedCount: conversation.summarizedCount,
      context: { limit, lastUsedTokens: conversation.lastUsedTokens ?? undefined }
    }
  }

  const FAILURE_TEXT: Record<string, string> = {
    timeout: 'The assistant took too long to reply.',
    cancelled: 'Stopped before the assistant replied.',
    'worlds-changed': 'A selected World was archived or deleted. Reload the Worlds and try again.',
    'options-changed':
      'A choice in your draft is no longer in the Rules Data. Review it and try again.'
  }

  async function send(message: string) {
    if (!message || busy || locked) return
    busy = true
    notice = null
    const controller = (inflight = new AbortController())
    let failure: TurnFailure | null = null
    try {
      const response = await fetch(`${endpoint}/turn`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          seed: $state.snapshot(seed),
          ...$state.snapshot(extraBody),
          history: historyOf(conversation),
          dismissed: dismissedNotes(conversation),
          pending: pendingProposals(conversation),
          ...contextPayload(),
          message
        })
      })
      const result = (await response.json().catch(() => null)) as
        (TurnResult & { status?: AiStatus }) | null
      if (
        result &&
        'ok' in result &&
        !result.ok &&
        (result.failure.kind === 'not-connected' || result.failure.kind === 'model-unavailable') &&
        result.status
      ) {
        // Nothing was sent: the panel switches to its not-connected state; the form still works.
        onunavailable?.(result.status)
      } else if (result && 'ok' in result && result.ok) {
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
    if (failure?.kind === 'worlds-changed') onworldschanged?.()
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
      const response = await fetch(`${endpoint}/compact`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          seed: $state.snapshot(seed),
          ...$state.snapshot(extraBody),
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
      } else if (result && !result.ok && result.failure.kind === 'reasoning-model') {
        notice = result.failure.message
        onreasoningmodel?.()
      } else if (result && !result.ok && result.failure.kind === 'timeout') {
        notice = 'Compaction took too long. Try again.'
      } else if (result && !result.ok && result.failure.kind === 'cancelled') {
        notice = 'Compaction stopped.'
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
      <li class="flex flex-col gap-1">
        <ChatBubble
          role={entry.role === 'user' ? 'user' : 'assistant'}
          error={entry.error !== undefined}
        >
          {entry.content}
        </ChatBubble>
        {#if entry.error !== undefined}
          <Alert variant="danger" class="flex items-center gap-2">
            <span>Failed: {entry.error}</span>
            <Button
              variant="secondary"
              size="sm"
              disabled={busy || locked}
              onclick={() => retry(entry.id)}>Retry</Button
            >
          </Alert>
        {/if}
        {#if entry.turn !== undefined}
          {@const cards = conversation.cards.filter((c) => c.turn === entry.turn)}
          {#if cards.length > 0}
            <ul aria-label="Proposals" class="space-y-1">
              {#each cards as card (card.id)}
                <li>
                  <ProposalCard
                    label={labels[card.field]}
                    value={formatValue?.(card.field, card.value) ?? card.value}
                    status={card.status}
                  >
                    {#snippet actions()}
                      {#if card.status === 'pending'}
                        <Button size="sm" onclick={() => accept(card.id)}>Accept</Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onclick={() => (conversation = dismissCard(conversation, card.id))}
                          >Dismiss</Button
                        >
                      {/if}
                    {/snippet}
                  </ProposalCard>
                </li>
              {/each}
            </ul>
          {/if}
        {/if}
      </li>
      {#if conversation.dividers.includes(entry.id)}
        <li
          role="separator"
          class="border-t border-dashed border-border pt-1 text-center text-xs text-muted"
        >
          Earlier messages above were summarized for the assistant
        </li>
      {/if}
    {/each}
  </ol>

  {#if !disabled}
    <ContextMeter {used} {limit} estimated={conversation.lastUsedTokens === null} />
  {/if}

  {#if busy}
    <p role="status" class="flex items-center gap-2 text-muted">
      Thinking…
      <Button variant="secondary" size="sm" onclick={stop}>Stop</Button>
    </p>
  {/if}

  <form
    onsubmit={(event) => {
      event.preventDefault()
      void send(draft.trim())
    }}
    class="space-y-2"
  >
    <Field label="Message">
      {#snippet children(id, describedby)}
        <Textarea
          {id}
          aria-describedby={describedby}
          bind:value={draft}
          disabled={busy || locked}
          rows={2}
        />
      {/snippet}
    </Field>
    <div class="flex gap-2">
      <Button type="submit" disabled={busy || locked || !draft.trim()}>Send</Button>
      <Button
        variant="secondary"
        type="button"
        disabled={busy || locked || !canCompact}
        onclick={compactNow}
      >
        Compact now
      </Button>
    </div>
  </form>

  {#if notice}
    <Alert variant="info">{notice}</Alert>
  {/if}

  {#if blocked !== null}
    <Alert variant="danger" class="space-y-2">
      <p>{blocked}. The chat is paused.</p>
      <div class="flex gap-2">
        <Button variant="secondary" size="sm" onclick={() => ((finished = true), (blocked = null))}
          >Finish on the seed card</Button
        >
        <Button variant="secondary" size="sm" onclick={clearChat}>Clear chat</Button>
      </div>
    </Alert>
  {/if}

  {#if finished}
    <Alert variant="info">The chat is closed. Finish your {subject} on the seed card.</Alert>
  {/if}
</div>
