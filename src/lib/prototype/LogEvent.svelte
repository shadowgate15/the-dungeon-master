<!-- PROTOTYPE (throwaway): one story-log entry, shared by all variants. -->
<script lang="ts">
  import type { EventKind, RollInfo } from './types.ts'

  let {
    event,
    streaming = false
  }: {
    event: {
      kind: EventKind
      text: string
      npcName?: string
      roll?: RollInfo
    }
    streaming?: boolean
  } = $props()
</script>

{#if event.kind === 'player-action'}
  <p class="text-accent italic">▸ {event.text}</p>
{:else if event.kind === 'narration'}
  <p class="leading-relaxed whitespace-pre-wrap">
    {event.text}{#if streaming}<span class="animate-pulse">▍</span>{/if}
  </p>
{:else if event.kind === 'npc-line'}
  <blockquote class="border-l-4 border-primary pl-3">
    <p class="text-xs font-semibold tracking-wide text-muted uppercase">{event.npcName}</p>
    <p class="whitespace-pre-wrap">
      “{event.text}{#if streaming}<span class="animate-pulse">▍</span>{:else}”{/if}
    </p>
  </blockquote>
{:else if event.kind === 'roll-requested'}
  <p class="inline-block rounded-full bg-warning-bg px-3 py-0.5 text-sm text-warning">
    🎲 {event.text}
  </p>
{:else if event.kind === 'roll-resolved'}
  <p
    class="inline-block rounded-full px-3 py-0.5 text-sm {event.roll?.success
      ? 'bg-success-bg text-success'
      : 'bg-danger-bg text-danger'}"
  >
    🎲 {event.text}
  </p>
{:else}
  <p class="text-center text-xs tracking-wide text-muted uppercase">— {event.text} —</p>
{/if}
