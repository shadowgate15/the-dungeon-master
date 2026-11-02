<!-- PROTOTYPE (issue #74): floating variant switcher. -->
<script lang="ts">
  import { goto } from '$app/navigation'
  import { page } from '$app/state'

  let { variants, current }: { variants: Record<string, string>; current: string } = $props()
  const keys = $derived(Object.keys(variants))

  function go(delta: number) {
    const next = keys[(keys.indexOf(current) + delta + keys.length) % keys.length]
    const params = new URLSearchParams(page.url.searchParams)
    params.set('variant', next)
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    goto(`?${params}`, { replaceState: true, noScroll: true })
  }
  function onkey(e: KeyboardEvent) {
    const t = e.target as HTMLElement
    if (t.closest('input, textarea, select, [contenteditable]')) return
    if (e.key === 'ArrowLeft') go(-1)
    if (e.key === 'ArrowRight') go(1)
  }
</script>

<svelte:window onkeydown={onkey} />

<div class="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-black px-4 py-2 text-sm text-white shadow-lg">
  <button type="button" onclick={() => go(-1)} aria-label="Previous variant">←</button>
  <span>{current} ({variants[current]})</span>
  <button type="button" onclick={() => go(1)} aria-label="Next variant">→</button>
</div>
