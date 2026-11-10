<script lang="ts">
  // PROTOTYPE (wipe me): three layouts of the play screen for ticket "Play screen layout".
  // ?variant=A|B|C  ?state=awaiting|roll|generating|failed|resumed|ended   All data stubbed, nothing persists.
  import { goto } from '$app/navigation'
  import { page } from '$app/state'

  const variants = [
    ['A', 'Classic: narrative + right rail'],
    ['B', 'Stacked: sheet strip on top, roll prompt docked above input'],
    ['C', 'Drawer: full-width log, sheet and dice in slide-over']
  ] as const
  const states = ['awaiting', 'roll', 'generating', 'failed', 'resumed', 'ended'] as const
  const variant = $derived(page.url.searchParams.get('variant') ?? 'A')
  const st = $derived(page.url.searchParams.get('state') ?? 'awaiting')
  const set = (k: string, v: string) => {
    const u = new URL(page.url)
    u.searchParams.set(k, v)
    goto(u, { replaceState: true, noScroll: true, keepFocus: true })
  }
  let drawer = $state(false)
  let input = $state('')

  const turns = [
    { who: 'dm', text: 'Rain hammers the shutters of the Gilded Stag. A hooded stranger slides a sealed letter across your table and leaves before you can speak.' },
    { who: 'player', text: 'I break the seal and read the letter.' },
    { who: 'dm', text: 'The wax bears a black raven. The letter names a crypt beneath Harrowmere chapel, and a reward of 200 gold for what lies within. Somewhere above, a floorboard creaks.' },
    { who: 'player', text: 'I draw my sword and listen at the stairs.' },
    { who: 'dm', text: 'You hold your breath. Something shifts in the dark overhead, deliberate and slow.' }
  ]
  const rollTurn = { who: 'dm', text: 'A shape drops from the rafters. You have a heartbeat to react.' }
  const sheet = { name: 'Brenna Ironvale', line: 'Level 1 Dwarf Fighter', hp: '12 / 12', ac: 16, speed: 25, abil: [['STR', 16, '+3'], ['DEX', 12, '+1'], ['CON', 15, '+2'], ['INT', 8, '−1'], ['WIS', 13, '+1'], ['CHA', 10, '+0']] }
  const req = { check: 'Dexterity (Acrobatics)', dc: 14, reason: 'Dodge the falling shape.', mod: '+1' }

  const log = $derived(
    st === 'roll' ? [...turns, rollTurn] : st === 'generating' ? [...turns, { who: 'player', text: 'I strike first.' }] : st === 'failed' ? [...turns, { who: 'player', text: 'I strike first.' }] : turns
  )
  const canType = $derived(st === 'awaiting' || st === 'resumed')
</script>

{#snippet logView()}
  {#if st === 'resumed'}
    <div class="rounded-control border border-border bg-raised p-2 text-center text-xs text-muted">Resumed Session 2 · 14 Turns · last played yesterday</div>
  {/if}
  {#each log as t, i (i)}
    <div class={t.who === 'dm' ? 'max-w-prose' : 'ml-auto max-w-prose rounded-control bg-raised p-2 text-right'}>
      <div class="text-xs text-muted uppercase">{t.who === 'dm' ? 'Dungeon Master' : 'You'}</div>
      <p>{t.text}</p>
    </div>
  {/each}
  {#if st === 'generating'}
    <div class="max-w-prose"><div class="text-xs text-muted uppercase">Dungeon Master</div><p>Your blade rings against the shape's claws as it twists<span class="animate-pulse">▍</span></p></div>
  {/if}
  {#if st === 'failed'}
    <div class="rounded-control border border-border p-2 text-sm">The DM couldn't answer. Your action is saved. <button class="underline">Retry</button></div>
  {/if}
  {#if st === 'ended'}
    <div class="rounded-control border border-border bg-raised p-2 text-center text-sm">Session ended. Read-only.</div>
  {/if}
{/snippet}

{#snippet sheetView()}
  <div class="space-y-2">
    <div><div class="font-semibold">{sheet.name}</div><div class="text-xs text-muted">{sheet.line}</div></div>
    <div class="grid grid-cols-6 gap-1 text-center text-xs">
      {#each sheet.abil as [k, s, m] (k)}<div class="rounded-control border border-border bg-raised p-1"><div class="text-muted">{k}</div><div class="font-semibold">{s}</div><div>{m}</div></div>{/each}
    </div>
    <div class="grid grid-cols-3 gap-1 text-center text-xs">
      <div class="rounded-control border border-border bg-raised p-1">HP<br /><b>{sheet.hp}</b></div>
      <div class="rounded-control border border-border bg-raised p-1">AC<br /><b>{sheet.ac}</b></div>
      <div class="rounded-control border border-border bg-raised p-1">Speed<br /><b>{sheet.speed}</b></div>
    </div>
  </div>
{/snippet}

{#snippet rollCard()}
  <div class="rounded-control border-2 border-border bg-raised p-3 text-sm" role="group" aria-label="Roll request">
    <div class="text-xs text-muted uppercase">DM asks for a check</div>
    <div class="font-semibold">Acrobatics (Dexterity)</div>
    <div>DC <b>{req.dc}</b> · your modifier <b>{req.mod}</b></div>
    <div class="text-muted">{req.reason}</div>
    <button class="mt-2 w-full rounded-control border border-border px-3 py-1.5 font-semibold">Roll d20</button>
  </div>
{/snippet}

{#snippet lastRoll()}
  <div class="rounded-control border border-border p-2 text-xs text-muted">Last roll: Acrobatics d20 12 + 1 = <b>13</b> vs DC 14: fail</div>
{/snippet}

{#snippet inputView()}
  <form class="flex gap-2" onsubmit={(e) => e.preventDefault()}>
    <textarea bind:value={input} disabled={!canType} rows="2" class="flex-1 rounded-control border border-border bg-raised p-2 text-sm"
      placeholder={st === 'roll' ? 'Roll the dice to continue' : st === 'ended' ? 'Session ended' : st === 'generating' ? 'The DM is responding…' : 'What do you do?'}></textarea>
    {#if st === 'generating'}
      <button type="button" class="rounded-control border border-border px-3">Stop</button>
    {:else}
      <button disabled={!canType} class="rounded-control border border-border px-3 disabled:opacity-40">Send</button>
    {/if}
  </form>
{/snippet}

<svelte:head><title>PROTOTYPE play screen</title></svelte:head>

<div class="mx-auto max-w-6xl p-4 pb-24">
  <div class="mb-2 flex items-center justify-between text-sm"><span><b>Harrowmere</b> · Session 2</span><button class="underline">End Session</button></div>

  {#if variant === 'A'}
    <div class="grid grid-cols-[1fr_20rem] gap-4">
      <section class="space-y-3 pb-36">{@render logView()}</section>
      <aside class="sticky top-4 h-fit space-y-3">
        {@render sheetView()}
        {#if st === 'roll'}{@render rollCard()}{:else}{@render lastRoll()}{/if}
      </aside>
    </div>
    <div class="pointer-events-none fixed inset-x-0 bottom-14 z-10 mx-auto max-w-6xl px-4">
      <div class="pointer-events-auto grid grid-cols-[1fr_20rem] gap-4">
        <div class="rounded-control border border-border bg-surface/95 p-2 shadow-lg backdrop-blur">{@render inputView()}</div>
      </div>
    </div>
  {:else if variant === 'B'}
    <div class="flex h-[75vh] flex-col gap-2">
      <details class="rounded-control border border-border p-2"><summary class="cursor-pointer text-sm">{sheet.name} · HP {sheet.hp} · AC {sheet.ac} <span class="text-muted">(expand sheet)</span></summary><div class="mt-2">{@render sheetView()}</div></details>
      <div class="flex-1 space-y-3 overflow-y-auto">{@render logView()}</div>
      {#if st === 'roll'}{@render rollCard()}{/if}
      {@render inputView()}
    </div>
  {:else}
    <div class="relative mx-auto flex h-[75vh] max-w-3xl flex-col gap-2">
      <div class="flex gap-2 text-xs"><button class="rounded-control border border-border px-2 py-1" onclick={() => (drawer = !drawer)}>Character &amp; dice {st === 'roll' ? '● roll pending' : ''}</button></div>
      <div class="flex-1 space-y-3 overflow-y-auto">{@render logView()}
        {#if st === 'roll'}{@render rollCard()}{/if}</div>
      {@render inputView()}
      {#if drawer}
        <aside class="absolute top-8 right-0 w-72 space-y-3 rounded-control border border-border bg-surface p-3 shadow-lg">{@render sheetView()}{@render lastRoll()}</aside>
      {/if}
    </div>
  {/if}
</div>

<div class="fixed bottom-3 left-1/2 flex -translate-x-1/2 flex-wrap items-center gap-2 rounded-full border border-border bg-raised px-3 py-1.5 text-xs shadow-lg">
  {#each variants as [k, name] (k)}<button class={variant === k ? 'font-bold underline' : ''} title={name} onclick={() => set('variant', k)}>{k}</button>{/each}
  <span class="text-muted">|</span>
  {#each states as s (s)}<button class={st === s ? 'font-bold underline' : ''} onclick={() => set('state', s)}>{s}</button>{/each}
  <span class="text-muted">{variants.find(([k]) => k === variant)?.[1]}</span>
</div>
