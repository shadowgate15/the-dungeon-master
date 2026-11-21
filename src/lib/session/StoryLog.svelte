<script lang="ts">
  import Button from '#lib/ui/Button.svelte'
  import { checkLabel, type CallAnswer, type CallView } from './call.ts'
  import type { Mode, SceneNpc, SessionEvent } from './enums.ts'

  let {
    events,
    npcs,
    live = '',
    liveNpcId = null,
    thinking = false,
    mode = 'exploration',
    openCall = null,
    onroll,
    onanswer
  }: {
    events: SessionEvent[]
    /** Who can speak a line: the Scene's NPCs and every NPC already heard in the log. */
    npcs: Pick<SceneNpc, 'id' | 'name'>[]
    /** Narration still streaming in; not in the log until it is saved. */
    live?: string
    /** The speaking NPC while the streaming line is an NPC line, else null. */
    liveNpcId?: string | null
    /** A step of the Exchange is running and no Reply text has streamed yet. */
    thinking?: boolean
    /** In dialogue, narration reads as a stage direction between spoken lines. */
    mode?: Mode
    /** The Call the Exchange waits on; shown inline at its `call-raised` event. Never has a DC. */
    openCall?: CallView | null
    /** Rolls the open Check; the Roll button is disabled without it. */
    onroll?: () => void
    /** Answers the open question with a choice; its choice buttons are disabled without it. */
    onanswer?: (answer: CallAnswer) => void
  } = $props()

  // The open Call is the latest one raised (a Session has at most one open at a time).
  const openId = $derived(
    openCall ? events.findLast((e) => e.kind === 'call-raised')?.id : undefined
  )
  const isWithdrawn = (e: SessionEvent) => e.data?.withdrawn === true
  /** Whether the Call raised at `index` was later withdrawn (its next answer says so). */
  const raisedWithdrawn = (index: number) => {
    const answer = events.slice(index + 1).find((e) => e.kind === 'call-answered')
    return answer !== undefined && isWithdrawn(answer)
  }

  const speaker = (npcId: string | null) =>
    npcs.find((n) => n.id === npcId)?.name ?? npcId ?? 'Someone'
</script>

<ol aria-label="Story log" class="space-y-3">
  {#each events as event, index (event.id)}
    <li>
      {#if event.kind === 'declaration'}
        <p class="text-accent italic">{event.text}</p>
      {:else if event.kind === 'narration'}
        {#if mode === 'dialogue'}
          <p data-aside class="text-sm text-muted italic">{event.text}</p>
        {:else}
          <p class="leading-relaxed whitespace-pre-wrap">{event.text}</p>
        {/if}
      {:else if event.kind === 'npc-line'}
        <blockquote class="border-l-4 border-primary pl-3">
          <p class="text-xs font-semibold tracking-wide text-muted uppercase">
            {speaker(event.npcId)}
          </p>
          <p class="whitespace-pre-wrap">&ldquo;{event.text}&rdquo;</p>
        </blockquote>
      {:else if event.kind === 'call-raised' && openCall?.kind === 'question' && event.id === openId}
        <div role="group" aria-label="Question" class="rounded-panel border border-primary p-2">
          <p class="font-semibold">{openCall.question}</p>
          {#if openCall.choices?.length}
            <div class="mt-2 flex flex-wrap gap-2">
              {#each openCall.choices as choice (choice)}
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={!onanswer}
                  onclick={() => onanswer?.({ kind: 'choice', choice })}>{choice}</Button
                >
              {/each}
            </div>
          {/if}
          <p class="mt-2 text-xs text-muted">
            {openCall.choices?.length ? 'Pick one, or type' : 'Type'} your answer below.
          </p>
        </div>
      {:else if event.kind === 'call-raised' && openCall?.kind === 'check' && event.id === openId}
        <div
          role="group"
          aria-label="Check"
          class="flex flex-wrap items-center justify-between gap-2 rounded-panel border border-primary p-2"
        >
          <div>
            <p class="font-semibold">{checkLabel(openCall.skill)} check</p>
            <p class="text-sm text-muted">{openCall.declaration.text}</p>
          </div>
          <Button type="button" disabled={!onroll} onclick={() => onroll?.()}>Roll</Button>
        </div>
      {:else if event.kind === 'call-raised' && event.data?.kind === 'question'}
        <p
          data-call
          data-withdrawn={raisedWithdrawn(index) || undefined}
          class={['text-sm', raisedWithdrawn(index) && 'text-muted line-through opacity-60']}
        >
          {event.text}
        </p>
      {:else if event.kind === 'call-raised'}
        <p
          data-call
          data-withdrawn={raisedWithdrawn(index) || undefined}
          class={['text-sm text-muted', raisedWithdrawn(index) && 'line-through opacity-60']}
        >
          {event.text}
        </p>
      {:else if event.kind === 'call-answered' && isWithdrawn(event)}
        <p data-call data-withdrawn class="text-sm text-muted italic opacity-60">{event.text}</p>
      {:else if event.kind === 'call-answered' && event.data?.kind === 'question'}
        <p data-answer class="text-accent italic">{event.text}</p>
      {:else if event.kind === 'call-answered'}
        <p
          data-call
          data-roll={event.data?.success === true ? 'success' : 'failure'}
          class="text-sm font-semibold"
        >
          {event.text}
        </p>
      {:else}
        <p class="text-center text-xs tracking-wide text-muted uppercase">{event.text}</p>
      {/if}
    </li>
  {/each}
  {#if live}
    {#if liveNpcId}
      <li aria-label="NPC line in progress">
        <blockquote class="border-l-4 border-primary pl-3">
          <p class="text-xs font-semibold tracking-wide text-muted uppercase">
            {speaker(liveNpcId)}
          </p>
          <p class="whitespace-pre-wrap">&ldquo;{live}</p>
        </blockquote>
      </li>
    {:else}
      <li aria-label="Narration in progress">
        <p class="leading-relaxed whitespace-pre-wrap">{live}</p>
      </li>
    {/if}
  {/if}
  {#if thinking && !live}
    <li role="status" class="text-sm text-muted italic">The Dungeon Master is thinking&hellip;</li>
  {/if}
</ol>
