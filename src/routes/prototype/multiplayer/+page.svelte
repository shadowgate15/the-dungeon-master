<script lang="ts">
  /* eslint-disable -- PROTOTYPE, throwaway */
  // PROTOTYPE (wipe me), for "What does the play console look like for one of several Players?" (#376).
  // Three variants of the multi-Player play console, switchable via ?variant=A|B|C, viewed as one
  // of four browsers via ?as=host|phone|tablet|new. All data is stubbed in table.svelte.ts and
  // shared by every browser in memory, so act as one browser and switch to see it from another.
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { dev } from '$app/env'
  import { browsers, browserName, floorBrowsers, nameOf, table } from './table.svelte.ts'
  import VariantA from './VariantA.svelte'
  import VariantB from './VariantB.svelte'
  import VariantC from './VariantC.svelte'

  const variants = [
    ['A', 'Seats: Claim page, table strip over the composer'],
    ['B', 'Roster: Claim dialog, "At the table" rail card'],
    ['C', 'Own seat: join list, table in the header, Host drawer']
  ] as const
  const variant = $derived(page.url.searchParams.get('variant') ?? 'A')
  const asKey = $derived(page.url.searchParams.get('as') ?? 'host')
  const viewer = $derived(browsers.find((b) => b.key === asKey) ?? browsers[0])
  const index = $derived(
    Math.max(
      0,
      variants.findIndex(([k]) => k === variant)
    )
  )

  function set(k: string, v: string) {
    const u = new URL(page.url.href)
    u.searchParams.set(k, v)
    goto(u, { replaceState: true })
  }
  const step = (d: number) =>
    set('variant', variants[(index + d + variants.length) % variants.length][0])

  function onkey(e: KeyboardEvent) {
    const t = e.target as HTMLElement
    if (t.closest('input, textarea, [contenteditable]')) return
    if (e.key === 'ArrowLeft') step(-1)
    if (e.key === 'ArrowRight') step(1)
  }
</script>

<svelte:window onkeydown={onkey} />
<svelte:head><title>Prototype · Multiplayer console</title></svelte:head>

<!-- Prototype chrome: which browser you are looking through. Not part of the design. -->
<div
  class="flex flex-wrap items-center gap-2 border-b-2 border-dashed border-fuchsia-500 bg-fuchsia-50 px-3 py-1.5 text-xs text-fuchsia-950 dark:bg-fuchsia-950 dark:text-fuchsia-100"
>
  <strong>PROTOTYPE</strong> Viewing as:
  {#each browsers as b (b.id)}
    <button
      class={[
        'rounded-full border border-fuchsia-500 px-2 py-0.5',
        b.id === viewer.id && 'bg-fuchsia-600 text-white'
      ]}
      onclick={() => set('as', b.key)}>{b.label}</button
    >
  {/each}
  <span class="ml-auto font-mono">
    claims: {Object.entries(table.claims)
      .map(([c, b]) => `${nameOf(c)}→${b ?? '·'}`)
      .join(' ')} | floor waits on: {floorBrowsers()
      .map((b) => `${browserName(b)}${table.done.includes(b) ? '✓' : '…'}`)
      .join(', ') || 'nobody'} | floors closed: {table.closed}
  </span>
</div>

{#key viewer.id}
  {#if variant === 'B'}
    <VariantB {viewer} />
  {:else if variant === 'C'}
    <VariantC {viewer} />
  {:else}
    <VariantA {viewer} />
  {/if}
{/key}

{#if dev}
  <div
    class="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-neutral-900 px-4 py-2 text-sm text-white shadow-2xl ring-2 ring-fuchsia-500"
  >
    <button aria-label="Previous variant" onclick={() => step(-1)}>←</button>
    <span>{variants[index][0]} ({variants[index][1]})</span>
    <button aria-label="Next variant" onclick={() => step(1)}>→</button>
  </div>
{/if}
