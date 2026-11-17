<!-- PROTOTYPE (throwaway): floating variant switcher. Dev-only. -->
<script lang="ts">
  import { goto } from '$app/navigation'
  import { dev } from '$app/env'

  let { variants, current }: { variants: { key: string; name: string }[]; current: string } =
    $props()

  const index = $derived(
    Math.max(
      0,
      variants.findIndex((v) => v.key === current)
    )
  )

  function go(delta: number) {
    const next = variants[(index + delta + variants.length) % variants.length]!
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    void goto(`?variant=${next.key}`, { replaceState: true })
  }

  function onkeydown(event: KeyboardEvent) {
    const el = event.target as HTMLElement | null
    if (el?.closest('input, textarea, [contenteditable]')) return
    if (event.key === 'ArrowLeft') go(-1)
    else if (event.key === 'ArrowRight') go(1)
  }
</script>

<svelte:window {onkeydown} />

{#if dev}
  <div
    class="fixed bottom-3 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-text px-4 py-2 text-sm text-bg shadow-overlay"
  >
    <button aria-label="Previous variant" class="px-1 text-lg" onclick={() => go(-1)}>←</button>
    <span class="font-medium">{variants[index]?.key} ({variants[index]?.name})</span>
    <button aria-label="Next variant" class="px-1 text-lg" onclick={() => go(1)}>→</button>
  </div>
{/if}
