<script lang="ts">
  import { EXPECTED_TURN_SECONDS, type TimelineEntry } from './timeline'

  /**
   * The console's centre: the Show filters above one timeline, DM on the left and the Player on
   * the right. Narrations (with the NPC voicing them), Declarations from closed Floors and muted
   * `⚙ DM …` activity lines; while the DM works on a turn, a `Ns / ~20s` progress bar.
   */
  let {
    entries,
    awaitingSince
  }: {
    entries: TimelineEntry[]
    /** When the DM started on the turn awaiting Narration; null when nothing awaits. */
    awaitingSince: number | null
  } = $props()

  let show = $state({ story: true, rolls: true, dm: true })
  const filters = [
    ['story', 'Story'],
    ['rolls', 'Rolls'],
    ['dm', 'DM activity']
  ] as const

  const shown = $derived(entries.filter((e) => (e.type === 'activity' ? show.dm : show.story)))

  let now = $state(Date.now())
  $effect(() => {
    if (awaitingSince === null) return
    now = Date.now()
    const tick = setInterval(() => (now = Date.now()), 1000)
    return () => clearInterval(tick)
  })
  const elapsed = $derived(
    awaitingSince === null ? 0 : Math.max(0, Math.floor((now - awaitingSince) / 1000))
  )
</script>

<div role="group" aria-label="Show" class="flex items-center gap-3 text-xs">
  <span class="text-muted">Show</span>
  {#each filters as [key, label] (key)}
    <label class="flex items-center gap-1">
      <input type="checkbox" bind:checked={show[key]} class="rounded" />
      {label}
    </label>
  {/each}
</div>
<ol
  aria-label="Timeline"
  class="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto rounded-panel border border-border bg-surface p-3"
>
  {#each shown as entry (entry.id)}
    {#if entry.type === 'narration'}
      <li class="max-w-[85%] self-start rounded-panel bg-raised px-3 py-2 text-sm">
        {#if entry.voice}<span class="block text-xs font-semibold text-primary">{entry.voice}</span
          >{/if}
        <span class="whitespace-pre-wrap">{entry.text}</span>
      </li>
    {:else if entry.type === 'declaration'}
      <li
        class="max-w-[85%] self-end rounded-panel border border-border bg-surface px-3 py-2 text-sm"
      >
        <span class="block text-xs font-semibold text-muted">{entry.character}</span>
        <span class="whitespace-pre-wrap">{entry.text}</span>
      </li>
    {:else}
      <li class="self-start text-xs text-muted">⚙ {entry.text}</li>
    {/if}
  {:else}
    {#if entries.length === 0}
      <li class="m-auto text-sm text-muted">Nothing has happened yet.</li>
    {/if}
  {/each}
</ol>
{#if awaitingSince !== null}
  <div class="flex items-center gap-2 text-xs text-muted">
    <div
      role="progressbar"
      aria-label="The DM is working"
      aria-valuemin="0"
      aria-valuemax={EXPECTED_TURN_SECONDS}
      aria-valuenow={Math.min(elapsed, EXPECTED_TURN_SECONDS)}
      class="h-1.5 flex-1 overflow-hidden rounded-full bg-border"
    >
      <div
        class="h-full bg-primary transition-[width]"
        style:width="{Math.min(100, (elapsed / EXPECTED_TURN_SECONDS) * 100)}%"
      ></div>
    </div>
    <span>{elapsed}s / ~{EXPECTED_TURN_SECONDS}s</span>
  </div>
{/if}
