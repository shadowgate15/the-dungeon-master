<script lang="ts">
  // PROTOTYPE variant B, "Book with drawers": one centred prose column, nothing beside it.
  // Sticky top bar = Scene, clock, initiative ribbon. Party strip above the composer.
  // Sheets, Journal, Dice, History open as a right-hand drawer. DM activity is a single
  // status line (no tool feed). Permission prompts are a modal.
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
    sessions,
    story,
    type Story
  } from '#lib/prototype/play-mock.ts'

  let { scenario, onsend, onresolve }: VariantProps = $props()
  const busy = $derived(scenario.status !== 'idle')
  const byId = Object.fromEntries(dice.map((d) => [d.id, d]))
  let drawer = $state<string | null>(null)

  // Group consecutive dice entries into one collapsible "rolls" line.
  type Block = Story | { kind: 'rolls'; id: string; refs: string[] }
  const blocks: Block[] = []
  for (const s of story) {
    const last = blocks.at(-1)
    if (s.kind === 'dice' && last?.kind === 'rolls') last.refs.push(s.ref)
    else if (s.kind === 'dice') blocks.push({ kind: 'rolls', id: s.id, refs: [s.ref] })
    else blocks.push(s)
  }
  const statusLine = $derived(
    scenario.elapsed < 4
      ? 'The DM considers your move'
      : (activity[Math.min(activity.length - 1, Math.floor(scenario.elapsed / 4) - 1)]?.text ??
          'The DM is writing')
  )
</script>

<div class="sticky top-0 z-20 border-b border-border bg-bg/95 backdrop-blur">
  <div class="mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-sm">
    <span class="font-display">{scene.place}</span>
    <span class="text-muted">{scene.clock}</span>
    <span class="ml-auto flex gap-1">
      {#each ['Sheets', 'Journal', 'Dice', 'History'] as d (d)}
        <button
          class={[
            'rounded-control px-2 py-0.5',
            drawer === d ? 'bg-primary text-on-primary' : 'hover:bg-raised'
          ]}
          onclick={() => (drawer = drawer === d ? null : d)}>{d}</button
        >
      {/each}
    </span>
  </div>
  {#if scenario.combat}
    <div class="mx-auto flex max-w-3xl items-center gap-1 overflow-x-auto px-4 pb-2 text-xs">
      <span class="mr-1 text-muted">Round {fight.round}</span>
      {#each fight.order as c, i (c.name)}
        <span
          class={[
            'shrink-0 rounded-full border px-2 py-0.5',
            i === fight.current ? 'border-transparent bg-primary text-on-primary' : 'border-border',
            c.kind === 'creature' && i !== fight.current && 'text-danger',
            c.state === 'down' && 'line-through opacity-50'
          ]}>{c.name} <span class="opacity-70">{c.state}</span></span
        >
        {#if i < fight.order.length - 1}<span class="text-muted">›</span>{/if}
      {/each}
    </div>
  {/if}
</div>

<main class="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6">
  <p class="text-center font-display text-sm tracking-widest text-muted uppercase">
    The Salt Road · Session 4
  </p>
  {#each blocks as b (b.id)}
    {#if b.kind === 'narration'}
      <p
        class={[
          'font-serif text-lg leading-8',
          b.recap && 'text-center text-base text-muted italic'
        ]}
      >
        {b.text}
      </p>
    {:else if b.kind === 'floor'}
      <div class="ml-8 flex flex-col gap-1 text-sm text-muted">
        {#each b.lines as l, i (i)}<p>
            — <span class="font-medium text-text">{l.who}</span>
            {l.text}
          </p>{/each}
      </div>
    {:else if b.kind === 'rolls'}
      <details class="ml-8 text-sm text-muted">
        <summary class="cursor-pointer">
          🎲 {b.refs
            .map(
              (r) =>
                `${byId[r].who} ${byId[r].total}${byId[r].outcome ? ' ' + byId[r].outcome : ''}`
            )
            .join(' · ')}
        </summary>
        <div class="mt-1 flex flex-col gap-1">
          {#each b.refs as r (r)}<DiceLine d={byId[r]} compact />{/each}
        </div>
      </details>
    {/if}
  {/each}

  {#if scenario.combat && !busy}<CallCard {onresolve} />{/if}
  {#if busy}
    <p class="text-center text-sm text-muted italic">
      <span class="animate-pulse">✒</span>
      {statusLine}… {scenario.elapsed}s
    </p>
  {/if}

  <div
    class="sticky bottom-0 -mx-4 flex flex-col gap-2 border-t border-border bg-bg px-4 pt-2 pb-20"
  >
    <div class="flex gap-2">
      {#each party as c (c.handle)}
        <button
          class={[
            'flex-1 rounded-control border border-border bg-surface px-2 py-1 text-left text-xs',
            c.whereabouts && 'opacity-50'
          ]}
          onclick={() => (drawer = 'Sheets')}
        >
          <span class="font-medium">{c.name}</span>
          <span class="float-right">{c.hp}/{c.maxHp}</span>
          <span class="mt-1 block h-1 rounded bg-border"
            ><span
              class={['block h-1 rounded', c.hp / c.maxHp < 0.5 ? 'bg-danger' : 'bg-success']}
              style="width: {(c.hp / c.maxHp) * 100}%"
            ></span></span
          >
          {#if c.conditions.length || c.concentrating}
            <span class="text-muted"
              >{[...c.conditions, c.concentrating && '◎ ' + c.concentrating]
                .filter(Boolean)
                .join(' · ')}</span
            >
          {/if}
        </button>
      {/each}
    </div>
    <Composer combat={scenario.combat} {busy} {onsend} />
  </div>
</main>

{#if drawer}
  <aside
    class="fixed top-0 right-0 z-30 h-full w-96 max-w-full overflow-y-auto border-l border-border bg-surface p-4 shadow-overlay"
  >
    <div class="mb-3 flex justify-between">
      <h2 class="font-display text-xl">{drawer}</h2>
      <button onclick={() => (drawer = null)} aria-label="Close">✕</button>
    </div>
    {#if drawer === 'Sheets'}
      {#each party as c (c.handle)}
        <section class="mb-4 border-b border-border pb-3 text-sm">
          <h3 class="font-display">
            {c.name}
            <span class="text-xs text-muted"
              >{c.cls} {c.level} · AC {c.ac} · HP {c.hp}/{c.maxHp}</span
            >
          </h3>
          <div class="my-1 grid grid-cols-6 text-center text-xs">
            {#each Object.entries(c.abilities) as [k, v] (k)}<div>
                <div class="text-muted">{k}</div>
                {v}
              </div>{/each}
          </div>
          {#each c.attacks as a (a.name)}<p>{a.name} +{a.toHit} · {a.damage}</p>{/each}
          {#each c.slots ?? [] as s (s.level)}<p>
              Slots L{s.level}: {s.max - s.used}/{s.max}
            </p>{/each}
          <p class="text-xs text-muted">{c.inventory.join(' · ')}</p>
        </section>
      {/each}
    {:else if drawer === 'Journal'}
      {#each beliefs as b, i (i)}<p class="mb-2 text-sm">
          {b.text}<br /><span class="text-xs text-muted">{b.holder} · {b.source}</span>
        </p>{/each}
    {:else if drawer === 'Dice'}
      {#each [...dice].reverse() as d (d.id)}<div class="mb-1.5"><DiceLine {d} /></div>{/each}
    {:else}
      {#each sessions as s (s.n)}<p class="mb-2 text-sm">
          <b>Session {s.n}.</b>
          {s.summary}
        </p>{/each}
    {/if}
  </aside>
{/if}

{#if scenario.status === 'permission'}
  <div class="fixed inset-0 z-40 grid place-items-center bg-black/40 p-4">
    <div class="w-full max-w-md"><PermissionPrompt onanswer={onresolve} /></div>
  </div>
{/if}
