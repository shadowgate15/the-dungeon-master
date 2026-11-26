<script lang="ts">
  import RailCard from './RailCard.svelte'
  import type { SceneView } from './scene'

  /**
   * The rail's top panel: the clock (time large, day below), the Scene's Place and the Characters
   * present, and in a Combat the initiative order under a pinned round header. A view of the
   * Player-safe `SceneView`.
   */
  let { scene }: { scene: SceneView } = $props()

  let body = $state<HTMLElement>()
  const currentKey = $derived(scene.combat?.order.find((c) => c.current)?.key)

  // When the turn moves on, bring the current combatant into view within the initiative card,
  // only if it is off-screen. Scrolls the card's body alone, never the page or the rail.
  $effect(() => {
    if (!body || currentKey === undefined) return
    const row = body.querySelector<HTMLElement>('[aria-current]')
    if (!row) return
    const top = row.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop
    const bottom = top + row.offsetHeight
    if (top < body.scrollTop) body.scrollTop = top
    else if (bottom > body.scrollTop + body.clientHeight)
      body.scrollTop = bottom - body.clientHeight
  })
</script>

<section
  aria-label="Clock and Scene"
  class="shrink-0 rounded-panel border border-border bg-surface p-3"
>
  <p class="font-display text-3xl">{scene.clock.time}</p>
  <p class="text-muted">day {scene.clock.day}</p>
  {#if scene.place}
    <p class="mt-2 font-medium">{scene.place.name}</p>
    <ul aria-label="Present" class="mt-1 flex flex-wrap gap-1 text-xs">
      {#each scene.present as c (c.id)}
        <li class="rounded-control bg-raised px-2 py-0.5">{c.name}</li>
      {/each}
    </ul>
  {:else}
    <p class="mt-2 text-muted">The Scene is set once play begins.</p>
  {/if}
</section>

{#if scene.combat}
  <RailCard id="initiative-heading" label="Initiative" headingClass="font-medium" bind:body>
    {#snippet heading()}
      {scene.combat?.round ? `Round ${scene.combat.round}` : 'Combat starts'}
    {/snippet}
    {#if scene.combat.order.length}
      <ol aria-label="Initiative order" class="flex flex-col gap-1 text-sm">
        {#each scene.combat.order as c (c.key)}
          <li
            aria-current={c.current || undefined}
            class={[
              'flex items-center gap-2 rounded-control px-2 py-0.5',
              c.current ? 'bg-raised font-medium' : 'text-muted'
            ]}
          >
            <span class="w-6 text-right tabular-nums">{c.initiative}</span>
            <span class="flex-1">{c.name}</span>
            {#if c.state}<span class="text-xs">{c.state}</span>{/if}
          </li>
        {/each}
      </ol>
    {/if}
    {#if scene.combat.waiting.length}
      <p class="mt-1 text-xs text-muted">Rolling initiative: {scene.combat.waiting.join(', ')}</p>
    {/if}
  </RailCard>
{/if}
