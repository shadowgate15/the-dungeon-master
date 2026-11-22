<script lang="ts">
  // PROTOTYPE: throwaway variant switcher for /prototype/* routes. Never ships.
  import type { Snippet } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'

  let {
    variants,
    current,
    extras
  }: { variants: { key: string; name: string }[]; current: string; extras?: Snippet } = $props()

  const index = $derived(
    Math.max(
      0,
      variants.findIndex((v) => v.key === current)
    )
  )

  function go(step: number) {
    const next = variants[(index + step + variants.length) % variants.length]
    const url = new URL(page.url.href)
    url.searchParams.set('variant', next.key)
    // eslint-disable-next-line svelte/no-navigation-without-resolve -- same-route query swap
    void goto(url, { replace: true, reset: false })
  }

  function onkeydown(e: KeyboardEvent) {
    const t = e.target as HTMLElement
    if (t.closest('input, textarea, select, [contenteditable]')) return
    if (e.key === 'ArrowLeft') go(-1)
    if (e.key === 'ArrowRight') go(1)
  }
</script>

<svelte:window {onkeydown} />

{#if import.meta.env.DEV}
  <div
    class="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 flex-wrap items-center gap-3 rounded-full bg-black px-4 py-2 font-mono text-xs text-white shadow-2xl ring-2 ring-fuchsia-500"
  >
    <button class="px-1 text-base" onclick={() => go(-1)} aria-label="Previous variant">←</button>
    <span>{variants[index].key} ({variants[index].name})</span>
    <button class="px-1 text-base" onclick={() => go(1)} aria-label="Next variant">→</button>
    {#if extras}
      <span class="h-4 w-px bg-white/40"></span>
      {@render extras()}
    {/if}
  </div>
{/if}
