<script lang="ts">
  // PROTOTYPE switcher: variant arrows + journal state, URL-backed. Dev only.
  import { goto } from '$app/navigation'
  import { page } from '$app/state'

  const variants = [
    ['A', 'Rail tabs'],
    ['B', 'Stacked rail'],
    ['C', 'Journal book']
  ] as const
  const states = ['empty', 'first', 'resumed'] as const
  const variant = $derived(page.url.searchParams.get('variant') ?? 'A')
  const state = $derived(page.url.searchParams.get('state') ?? 'resumed')

  function set(key: string, value: string) {
    const url = new URL(page.url.href)
    url.searchParams.set(key, value)
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    void goto(url, { replaceState: true })
  }
  function cycle(d: number) {
    const i = variants.findIndex(([k]) => k === variant)
    set('variant', variants[(i + d + variants.length) % variants.length][0])
  }
  function onkey(ev: KeyboardEvent) {
    if ((ev.target as HTMLElement).closest('input,textarea,[contenteditable]')) return
    if (ev.key === 'ArrowLeft') cycle(-1)
    if (ev.key === 'ArrowRight') cycle(1)
  }
</script>

<svelte:window onkeydown={onkey} />
{#if import.meta.env.DEV}
  <div
    class="fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-black px-4 py-2 text-sm text-white shadow-xl"
  >
    <button aria-label="Previous variant" onclick={() => cycle(-1)}>←</button>
    <span>{variant} ({variants.find(([k]) => k === variant)?.[1]})</span>
    <button aria-label="Next variant" onclick={() => cycle(1)}>→</button>
    <span class="opacity-40">|</span>
    {#each states as s (s)}
      <button
        class={state === s ? 'font-bold underline' : 'opacity-70'}
        onclick={() => set('state', s)}>{s}</button
      >
    {/each}
  </div>
{/if}
