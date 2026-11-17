<!-- PROTOTYPE (throwaway): the scrolling story log, including the streaming event. -->
<script lang="ts">
  import LogEvent from './LogEvent.svelte'
  import type { SceneStore } from './store.svelte.ts'

  let { store, class: className = '' }: { store: SceneStore; class?: string } = $props()

  let el: HTMLElement | undefined = $state()

  $effect(() => {
    void store.state.log.length
    void store.live?.text
    void store.thinking
    el?.scrollTo({ top: el.scrollHeight })
  })
</script>

<div bind:this={el} class="space-y-3 overflow-y-auto {className}">
  {#each store.state.log as event (event.id)}
    <LogEvent {event} />
  {/each}
  {#if store.live}
    <LogEvent event={store.live} streaming />
  {/if}
  {#if store.thinking}
    <p class="animate-pulse text-sm text-muted italic">{store.thinking}…</p>
  {/if}
</div>
