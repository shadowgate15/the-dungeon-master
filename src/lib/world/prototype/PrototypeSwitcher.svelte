<script lang="ts">
  // PROTOTYPE: throwaway floating variant switcher (dev only).
  import { dev } from '$app/env'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'

  let { variants }: { variants: { key: string; name: string }[] } = $props()

  const current = $derived(page.url.searchParams.get('variant') ?? variants[0].key)
  const index = $derived(
    Math.max(
      0,
      variants.findIndex((v) => v.key === current)
    )
  )

  function go(delta: number) {
    const next = variants[(index + delta + variants.length) % variants.length]
    const url = new URLSearchParams(page.url.search) // eslint-disable-line svelte/prefer-svelte-reactivity
    if (next.key === variants[0].key) url.delete('variant')
    else url.set('variant', next.key)
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    goto(`?${url}`, { replaceState: true })
  }

  function onkeydown(e: KeyboardEvent) {
    const el = e.target as HTMLElement | null
    if (el?.matches('input, textarea, select, [contenteditable]')) return
    if (e.key === 'ArrowLeft') go(-1)
    if (e.key === 'ArrowRight') go(1)
  }
</script>

<svelte:window {onkeydown} />

{#if dev}
  <div
    class="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-black px-4 py-2 text-sm text-white shadow-xl ring-2 ring-fuchsia-400"
  >
    <button type="button" aria-label="Previous variant" class="px-1" onclick={() => go(-1)}
      >←</button
    >
    <span class="min-w-48 text-center font-mono"
      >{variants[index].key} · {variants[index].name}</span
    >
    <button type="button" aria-label="Next variant" class="px-1" onclick={() => go(1)}>→</button>
  </div>
{/if}
