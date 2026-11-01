<script lang="ts">
  // PROTOTYPE (wipe me): floating variant switcher
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  let { variants }: { variants: Record<string, string> } = $props()
  const keys = $derived(Object.keys(variants))
  const current = $derived(page.url.searchParams.get('variant') ?? keys[0])
  function go(d: number) {
    const next = keys[(keys.indexOf(current) + d + keys.length) % keys.length]
    goto(`?variant=${next}`, { replaceState: true })
  }
  function onkey(e: KeyboardEvent) {
    const t = e.target as HTMLElement
    if (t.closest('input, textarea, select, [contenteditable]')) return
    if (e.key === 'ArrowLeft') go(-1)
    if (e.key === 'ArrowRight') go(1)
  }
</script>

<svelte:window onkeydown={onkey} />
<div class="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-black px-4 py-2 text-sm text-white shadow-xl">
  <button onclick={() => go(-1)} aria-label="previous">←</button>
  <span>{current} ({variants[current]})</span>
  <button onclick={() => go(1)} aria-label="next">→</button>
</div>
