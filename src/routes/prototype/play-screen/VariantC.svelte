<script lang="ts">
  // PROTOTYPE variant C, "Sheet-first console": the selected Character's full sheet is the left
  // column and its tab IS the "acting as" picker. Centre is one filterable timeline where
  // narration, rolls and DM tool activity interleave and persist. Narrow right rail: Scene,
  // initiative, Beliefs. Permission prompts are a toast, top right.
  import Meter from '#lib/ui/Meter.svelte'
  import Badge from '#lib/ui/Badge.svelte'
  import Composer from '#lib/prototype/Composer.svelte'
  import DiceLine from '#lib/prototype/DiceLine.svelte'
  import CallCard from '#lib/prototype/CallCard.svelte'
  import PermissionPrompt from '#lib/prototype/PermissionPrompt.svelte'
  import type { VariantProps } from '#lib/prototype/types.ts'
  import {
    activity,
    beliefs,
    combat as fight,
    dice,
    party,
    scene,
    story
  } from '#lib/prototype/play-mock.ts'

  let { scenario, onsend, onresolve }: VariantProps = $props()
  const busy = $derived(scenario.status !== 'idle')
  const byId = Object.fromEntries(dice.map((d) => [d.id, d]))
  let acting = $state('Bram')
  const c = $derived(party.find((p) => p.name === acting)!)
  let show = $state({ story: true, rolls: true, dm: true })

  // Interleave persisted DM activity after the last narration, for the timeline.
  const timeline = [
    ...story.slice(0, -1),
    ...activity.slice(0, 3).map((a, i) => ({ kind: 'dm' as const, id: 'a' + i, text: a.text })),
    story.at(-1)!
  ]
  const mod = (n: number) => (n >= 10 ? '+' : '') + Math.floor((n - 10) / 2)
</script>

<main
  class="grid h-[calc(100dvh-3.1rem)] grid-cols-1 gap-3 overflow-hidden p-3 pb-16 lg:grid-cols-[20rem_1fr_15rem]"
>
  <!-- Sheet -->
  <aside
    class="flex min-h-0 flex-col overflow-y-auto rounded-panel border border-border bg-surface"
  >
    <div class="flex border-b border-border">
      {#each party as p (p.handle)}
        <button
          class={[
            'flex-1 px-2 py-2 text-sm',
            acting === p.name && 'bg-raised font-semibold',
            p.whereabouts && 'text-muted'
          ]}
          onclick={() => (acting = p.name)}
          >{p.name}{#if p.whereabouts}<span class="block text-[10px]">{p.whereabouts}</span
            >{/if}</button
        >
      {/each}
    </div>
    <div class="flex flex-col gap-3 p-3 text-sm">
      <div>
        <h2 class="font-display text-xl">{c.name}</h2>
        <p class="text-muted">{c.cls} {c.level} · AC {c.ac}</p>
      </div>
      <div>
        <div class="flex justify-between text-xs">
          <span>HP</span><span>{c.hp} / {c.maxHp}</span>
        </div>
        <Meter label="HP" used={c.hp} limit={c.maxHp} warn={c.hp / c.maxHp < 0.5} />
      </div>
      <div class="flex flex-wrap gap-1">
        {#each c.conditions as x (x)}<Badge variant="danger" size="sm">{x}</Badge>{/each}
        {#if c.concentrating}<Badge variant="info" size="sm">Concentrating: {c.concentrating}</Badge
          >{/if}
      </div>
      <div class="grid grid-cols-3 gap-1 text-center">
        {#each Object.entries(c.abilities) as [k, v] (k)}
          <div class="rounded-control border border-border py-1">
            <div class="text-[10px] text-muted">{k}</div>
            <div class="text-lg">{mod(v)}</div>
            <div class="text-[10px] text-muted">{v}</div>
          </div>
        {/each}
      </div>
      <div>
        <h3 class="text-xs font-semibold text-muted uppercase">Attacks</h3>
        {#each c.attacks as a (a.name)}<p>
            {a.name} <span class="font-mono">+{a.toHit}</span> · {a.damage}
          </p>{/each}
      </div>
      {#if c.slots}
        <div>
          <h3 class="text-xs font-semibold text-muted uppercase">Spell slots</h3>
          {#each c.slots as s (s.level)}<p>
              Level {s.level}: {'●'.repeat(s.max - s.used)}{'○'.repeat(s.used)}
            </p>{/each}
        </div>
      {/if}
      {#if c.features}
        <div>
          <h3 class="text-xs font-semibold text-muted uppercase">Features</h3>
          {#each c.features as f (f.name)}<p>
              {f.name}
              {f.max - f.used}/{f.max} <span class="text-muted">per {f.per}</span>
            </p>{/each}
        </div>
      {/if}
      <div>
        <h3 class="text-xs font-semibold text-muted uppercase">Inventory</h3>
        <ul>
          {#each c.inventory as i (i)}<li>{i}</li>{/each}
        </ul>
      </div>
    </div>
  </aside>

  <!-- Timeline -->
  <section class="flex min-h-0 flex-col gap-2">
    <div class="flex items-center gap-2 text-xs">
      <span class="text-muted">Show</span>
      {#each [['story', 'Story'], ['rolls', 'Rolls'], ['dm', 'DM activity']] as [k, label] (k)}
        <label class="flex items-center gap-1"
          ><input type="checkbox" bind:checked={show[k as keyof typeof show]} class="rounded" />
          {label}</label
        >
      {/each}
    </div>
    <div
      class="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto rounded-panel border border-border bg-surface p-3"
    >
      {#each timeline as s (s.id)}
        {#if (s.kind === 'narration' || s.kind === 'floor') && show.story}
          {#if s.kind === 'narration'}
            <div class="rounded-control bg-raised p-3 leading-relaxed">
              {#if s.recap}<p class="mb-1 text-xs font-semibold text-accent uppercase">
                  Previously
                </p>{/if}
              {s.text}
            </div>
          {:else}
            {#each s.lines as l, i (i)}
              <p class="self-end rounded-control bg-primary/10 px-3 py-1 text-sm">
                <span class="font-medium">{l.who}</span>
                {l.text}
              </p>
            {/each}
          {/if}
        {:else if s.kind === 'dice' && show.rolls}
          <div class="flex items-center gap-2 px-1">
            <span>🎲</span><DiceLine d={byId[s.ref]} compact />
          </div>
        {:else if s.kind === 'dm' && show.dm}
          <p class="px-1 font-mono text-[11px] text-muted">⚙ DM {s.text}</p>
        {/if}
      {/each}
      {#if scenario.combat && !busy}<CallCard {onresolve} />{/if}
      {#if busy}
        <div class="mt-1 flex items-center gap-2 text-sm">
          <div class="h-1.5 flex-1 overflow-hidden rounded bg-border">
            <div
              class="h-full bg-primary transition-all"
              style="width: {Math.min(95, (scenario.elapsed / 20) * 100)}%"
            ></div>
          </div>
          <span class="font-mono text-xs">{scenario.elapsed}s / ~20s</span>
        </div>
        {#if show.dm}
          {#each activity.slice(3, 3 + Math.floor(scenario.elapsed / 5)) as a (a.t)}
            <p class="px-1 font-mono text-[11px] text-muted">⚙ DM {a.text}</p>
          {/each}
        {/if}
      {/if}
    </div>
    {#if scenario.status === 'permission'}<PermissionPrompt onanswer={onresolve} />{/if}
    <Composer combat={scenario.combat} {busy} {onsend} showPicker={false} bind:actingAs={acting} />
  </section>

  <!-- Rail -->
  <aside class="flex min-h-0 flex-col gap-3 overflow-y-auto text-sm">
    <div class="rounded-panel border border-border bg-surface p-3">
      <p class="font-display text-3xl">{scene.clock.split(', ')[1]}</p>
      <p class="text-muted">{scene.clock.split(', ')[0]}</p>
      <p class="mt-2 font-medium">{scene.place}</p>
      <p class="text-xs text-muted">{scene.light} · {scene.npcsPresent.join(', ')}</p>
    </div>
    {#if scenario.combat}
      <div class="rounded-panel border border-border bg-surface p-3">
        <h2 class="mb-1 text-xs font-semibold text-muted uppercase">Initiative · R{fight.round}</h2>
        {#each fight.order as o, i (o.name)}
          <p
            class={[
              'flex justify-between',
              i === fight.current && 'font-bold text-primary',
              o.state === 'down' && 'opacity-40'
            ]}
          >
            <span>{i === fight.current ? '▶ ' : ''}{o.name}</span><span class="text-xs"
              >{o.state}</span
            >
          </p>
        {/each}
      </div>
    {/if}
    <div class="rounded-panel border border-border bg-surface p-3">
      <h2 class="mb-1 text-xs font-semibold text-muted uppercase">What {acting} knows</h2>
      {#each beliefs.filter((b) => b.holder === acting || b.holder === 'Party') as b, i (i)}
        <p class="mb-1">{b.text}</p>
      {/each}
    </div>
  </aside>
</main>
