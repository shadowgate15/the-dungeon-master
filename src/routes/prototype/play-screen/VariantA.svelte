<script lang="ts">
  // PROTOTYPE variant A, "Three-column table": Party cards | story + composer | tabbed side panel.
  // DM tool activity appears live under the thinking timer; permission prompts sit above the composer.
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
    sessions,
    story
  } from '#lib/prototype/play-mock.ts'

  let { scenario, onsend, onresolve }: VariantProps = $props()
  const tabs = ['Scene', 'Dice', 'Journal', 'History'] as const
  let tab = $state<(typeof tabs)[number]>('Scene')
  let open = $state('char:bram')
  const busy = $derived(scenario.status !== 'idle')
  const byId = Object.fromEntries(dice.map((d) => [d.id, d]))
</script>

<main class="mx-auto flex max-w-7xl flex-col gap-3 p-4">
  <header class="flex items-baseline justify-between">
    <div>
      <p class="text-sm text-muted">The Salt Road</p>
      <h1 class="font-display text-2xl">Session 4</h1>
    </div>
    <button class="text-sm underline">End sitting</button>
  </header>

  <div class="grid grid-cols-1 gap-3 lg:grid-cols-[16rem_1fr_19rem]">
    <!-- Party -->
    <aside aria-label="Party" class="flex flex-col gap-2">
      {#each party as c (c.handle)}
        <div
          class={[
            'rounded-panel border border-border bg-surface p-2',
            c.whereabouts && 'opacity-60'
          ]}
        >
          <button
            class="flex w-full items-baseline justify-between"
            onclick={() => (open = c.handle)}
          >
            <span class="font-display">{c.name}</span>
            <span class="text-xs text-muted">{c.cls} {c.level} · AC {c.ac}</span>
          </button>
          <Meter
            label="{c.name} HP"
            used={c.hp}
            limit={c.maxHp}
            warn={c.hp / c.maxHp < 0.5}
            class="mt-1"
          />
          <p class="text-xs text-muted">HP {c.hp}/{c.maxHp}</p>
          <div class="mt-1 flex flex-wrap gap-1">
            {#each c.conditions as cond (cond)}<Badge size="sm" variant="danger">{cond}</Badge
              >{/each}
            {#if c.concentrating}<Badge size="sm" variant="info">◎ {c.concentrating}</Badge>{/if}
            {#if c.whereabouts}<Badge size="sm">elsewhere: {c.whereabouts}</Badge>{/if}
          </div>
          {#if open === c.handle}
            <div class="mt-2 border-t border-border pt-2 text-xs">
              <div class="grid grid-cols-6 gap-1 text-center">
                {#each Object.entries(c.abilities) as [k, v] (k)}
                  <div>
                    <div class="text-muted">{k}</div>
                    <div>{v}</div>
                  </div>
                {/each}
              </div>
              {#each c.attacks as a (a.name)}<p class="mt-1">
                  {a.name} +{a.toHit} · {a.damage}
                </p>{/each}
              {#each c.slots ?? [] as s (s.level)}
                <p>Slots L{s.level}: {'●'.repeat(s.max - s.used)}{'○'.repeat(s.used)}</p>
              {/each}
              {#each c.features ?? [] as f (f.name)}
                <p>{f.name}: {f.max - f.used}/{f.max} per {f.per}</p>
              {/each}
              <p class="mt-1 text-muted">{c.inventory.join(' · ')}</p>
            </div>
          {/if}
        </div>
      {/each}
    </aside>

    <!-- Story -->
    <section aria-label="Story" class="flex flex-col gap-3">
      <div class="flex flex-col gap-3 rounded-panel border border-border bg-surface p-4">
        {#each story as s (s.id)}
          {#if s.kind === 'narration'}
            <p
              class={[
                'leading-relaxed',
                s.recap && 'border-l-2 border-accent pl-3 text-muted italic'
              ]}
            >
              {s.text}
            </p>
          {:else if s.kind === 'floor'}
            <div class="flex flex-col gap-0.5 border-l-2 border-primary pl-3 text-sm">
              {#each s.lines as l, i (i)}<p>
                  <span class="font-medium">{l.who}:</span>
                  {l.text}
                </p>{/each}
            </div>
          {:else}
            <div class="pl-3"><DiceLine d={byId[s.ref]} compact /></div>
          {/if}
        {/each}

        {#if scenario.combat && !busy}<CallCard {onresolve} />{/if}

        {#if busy}
          <div class="rounded-control bg-raised p-2 text-sm">
            <p class="font-medium">
              <span class="animate-pulse">●</span> The DM is thinking… {scenario.elapsed}s
              <span class="text-xs text-muted">(usually about 20s)</span>
            </p>
            <ul class="mt-1 text-xs text-muted">
              {#each activity.slice(0, Math.min(activity.length, Math.floor(scenario.elapsed / 3) + 1)) as a (a.t)}
                <li>· {a.text}</li>
              {/each}
            </ul>
          </div>
        {/if}
      </div>

      {#if scenario.status === 'permission'}<PermissionPrompt onanswer={onresolve} />{/if}
      <Composer combat={scenario.combat} {busy} {onsend} />
    </section>

    <!-- Side panel -->
    <aside class="flex flex-col gap-3">
      {#if scenario.combat}
        <div class="rounded-panel border border-border bg-surface p-3" aria-label="Combat">
          <h2 class="font-display">Combat · round {fight.round}</h2>
          <ol class="mt-2 flex flex-col gap-1 text-sm">
            {#each fight.order as c, i (c.name)}
              <li
                class={[
                  'flex justify-between rounded-control px-2 py-1',
                  i === fight.current ? 'bg-primary text-on-primary' : 'bg-raised',
                  c.state === 'down' && 'line-through opacity-50'
                ]}
              >
                <span>{c.init} · {c.name}</span><span class="text-xs">{c.state}</span>
              </li>
            {/each}
          </ol>
          <p class="mt-2 text-xs text-muted">
            Bram this turn: Action {fight.economy.action ? '✓' : '✗'} · Bonus {fight.economy.bonus
              ? '✓'
              : '✗'} · Reaction {fight.economy.reaction ? '✓' : '✗'}
          </p>
        </div>
      {/if}

      <div class="rounded-panel border border-border bg-surface">
        <div class="flex border-b border-border text-sm">
          {#each tabs as t (t)}
            <button
              class={['flex-1 px-2 py-1.5', tab === t && 'border-b-2 border-primary font-medium']}
              onclick={() => (tab = t)}>{t}</button
            >
          {/each}
        </div>
        <div class="p-3 text-sm">
          {#if tab === 'Scene'}
            <p class="font-display">{scene.place}</p>
            <p class="text-muted">{scene.clock} · {scene.light}</p>
            <p class="mt-2">Here: {scene.npcsPresent.join(', ')}</p>
          {:else if tab === 'Dice'}
            <div class="flex flex-col gap-1.5">
              {#each [...dice].reverse() as d (d.id)}<DiceLine {d} compact />{/each}
            </div>
          {:else if tab === 'Journal'}
            <ul class="flex flex-col gap-2">
              {#each beliefs as b, i (i)}
                <li>
                  <p>{b.text}</p>
                  <p class="text-xs text-muted">{b.holder} · {b.source}</p>
                </li>
              {/each}
            </ul>
          {:else}
            {#each sessions as s (s.n)}<p class="mb-2">
                <span class="font-medium">Session {s.n}.</span>
                {s.summary}
              </p>{/each}
          {/if}
        </div>
      </div>
    </aside>
  </div>
</main>
