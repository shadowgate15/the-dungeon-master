<!-- PROTOTYPE (throwaway): three layouts for the character creation wizard on one route.
     /prototype/character-wizard?variant=A|B|C   (←/→ cycles). All data is mocked in memory. -->
<script lang="ts">
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { Wizard } from './model.svelte.ts'
  import VariantA from './VariantA.svelte'
  import VariantB from './VariantB.svelte'
  import VariantC from './VariantC.svelte'

  const variants = [
    ['A', 'Rail + panel'],
    ['B', 'Sheet-first'],
    ['C', 'Conversation-first']
  ] as const
  const w = new Wizard()
  const current = $derived(page.url.searchParams.get('variant') ?? 'A')
  const index = $derived(
    Math.max(
      0,
      variants.findIndex(([k]) => k === current)
    )
  )

  function cycle(d: number) {
    const k = variants[(index + d + variants.length) % variants.length][0]
    // eslint-disable-next-line svelte/no-navigation-without-resolve -- prototype
    void goto(`?variant=${k}`, { replaceState: true })
  }
  function onkey(e: KeyboardEvent) {
    const t = e.target as HTMLElement
    if (t.closest('input, textarea, select, [contenteditable]')) return
    if (e.key === 'ArrowLeft') cycle(-1)
    if (e.key === 'ArrowRight') cycle(1)
  }
</script>

<svelte:window onkeydown={onkey} />

{#if current === 'B'}<VariantB {w} />{:else if current === 'C'}<VariantC {w} />{:else}<VariantA
    {w}
  />{/if}

<div
  class="fixed bottom-14 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-black px-4 py-2 text-sm text-white shadow-lg"
>
  <button type="button" aria-label="Previous variant" onclick={() => cycle(-1)}>←</button>
  <span>{variants[index][0]} ({variants[index][1]})</span>
  <button type="button" aria-label="Next variant" onclick={() => cycle(1)}>→</button>
</div>
