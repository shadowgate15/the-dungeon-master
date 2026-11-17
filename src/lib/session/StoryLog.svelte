<script lang="ts">
  import type { SceneNpc, SessionEvent } from './enums.ts'

  let {
    events,
    npcs,
    live = '',
    thinking = false
  }: {
    events: SessionEvent[]
    npcs: SceneNpc[]
    /** Narration still streaming in; not in the log until it is saved. */
    live?: string
    /** The Director is choosing. */
    thinking?: boolean
  } = $props()

  const speaker = (event: SessionEvent) =>
    npcs.find((n) => n.id === event.npcId)?.name ?? event.npcId ?? 'Someone'
</script>

<ol aria-label="Story log" class="space-y-3">
  {#each events as event (event.id)}
    <li>
      {#if event.kind === 'player-action'}
        <p class="text-accent italic">{event.text}</p>
      {:else if event.kind === 'narration'}
        <p class="leading-relaxed whitespace-pre-wrap">{event.text}</p>
      {:else if event.kind === 'npc-line'}
        <blockquote class="border-l-4 border-primary pl-3">
          <p class="text-xs font-semibold tracking-wide text-muted uppercase">{speaker(event)}</p>
          <p class="whitespace-pre-wrap">&ldquo;{event.text}&rdquo;</p>
        </blockquote>
      {:else if event.kind === 'roll-requested'}
        <p class="inline-block rounded-full bg-warning-bg px-3 py-0.5 text-sm text-warning">
          {event.text}
        </p>
      {:else if event.kind === 'roll-resolved'}
        <p class="inline-block rounded-full bg-info-bg px-3 py-0.5 text-sm text-info">
          {event.text}
        </p>
      {:else}
        <p class="text-center text-xs tracking-wide text-muted uppercase">{event.text}</p>
      {/if}
    </li>
  {/each}
  {#if live}
    <li aria-label="Narration in progress">
      <p class="leading-relaxed whitespace-pre-wrap">{live}</p>
    </li>
  {/if}
  {#if thinking && !live}
    <li role="status" class="text-sm text-muted italic">The Dungeon Master is thinking&hellip;</li>
  {/if}
</ol>
