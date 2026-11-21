<script lang="ts">
  import type { Mode, SceneNpc, SessionEvent } from './enums.ts'

  let {
    events,
    npcs,
    live = '',
    liveNpcId = null,
    thinking = false,
    mode = 'exploration'
  }: {
    events: SessionEvent[]
    npcs: SceneNpc[]
    /** Narration still streaming in; not in the log until it is saved. */
    live?: string
    /** The speaking NPC while the streaming line is an NPC line, else null. */
    liveNpcId?: string | null
    /** A step of the Exchange is running and no Reply text has streamed yet. */
    thinking?: boolean
    /** In dialogue, narration reads as a stage direction between spoken lines. */
    mode?: Mode
  } = $props()

  const speaker = (npcId: string | null) =>
    npcs.find((n) => n.id === npcId)?.name ?? npcId ?? 'Someone'
</script>

<ol aria-label="Story log" class="space-y-3">
  {#each events as event (event.id)}
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
      {:else if event.kind === 'call-raised' || event.kind === 'call-answered'}
        <p data-call class="text-sm text-muted">{event.text}</p>
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
