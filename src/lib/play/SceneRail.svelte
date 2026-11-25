<script lang="ts">
  import type { SceneView } from './scene'

  /**
   * The rail's top panel: the clock (time large, day below), the Scene's Place and the Characters
   * present, and in a Combat the initiative order. A pure view of the Player-safe `SceneView`.
   */
  let { scene }: { scene: SceneView } = $props()
</script>

<section aria-label="Clock and Scene" class="rounded-panel border border-border bg-surface p-3">
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
  <section aria-label="Initiative" class="rounded-panel border border-border bg-surface p-3">
    <p class="font-medium">
      {scene.combat.round ? `Round ${scene.combat.round}` : 'Combat starts'}
    </p>
    {#if scene.combat.order.length}
      <ol aria-label="Initiative order" class="mt-1 flex flex-col gap-1 text-sm">
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
  </section>
{/if}
