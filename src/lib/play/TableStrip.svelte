<script lang="ts">
  import Button from '#lib/ui/Button.svelte'
  import type { TableBrowser, TableCharacter } from './floor'

  /**
   * The table strip above the composer: every browser with a Character in the Scene, named by those
   * Characters ("You (Wren)", "Bram & Kael") and marked deciding or Done ✓, plus the unclaimed
   * Characters who sit out. Your own chip offers Not done yet while Done; the Host sees Release per
   * Character on the other browsers' chips. A pure view; the console wires the callbacks.
   */
  let {
    browsers,
    unclaimed,
    isHost,
    onundone,
    onrelease
  }: {
    browsers: TableBrowser[]
    unclaimed: TableCharacter[]
    isHost: boolean
    /** Takes your Done back. */
    onundone: () => void
    /** The Host frees one Character of another browser. */
    onrelease: (character: string) => void
  } = $props()

  const names = (b: TableBrowser) => {
    const joined = b.characters.map((c) => c.name).join(' & ')
    return b.own ? `You (${joined})` : joined
  }
</script>

{#if browsers.length || unclaimed.length}
  <ul class="flex flex-wrap gap-2 text-xs" aria-label="The table">
    {#each browsers as b, i (i)}
      <li class="flex items-center gap-2 rounded-control bg-surface px-2 py-1">
        <span class="font-medium">{names(b)}</span>
        <span class={b.done ? 'text-success' : 'text-muted'}>{b.done ? 'Done ✓' : 'deciding'}</span>
        {#if b.own && b.done}
          <Button size="sm" variant="ghost" onclick={onundone}>Not done yet</Button>
        {/if}
        {#if isHost && !b.own}
          {#each b.characters as c (c.id)}
            <Button size="sm" variant="ghost" onclick={() => onrelease(c.id)}
              >Release {c.name}</Button
            >
          {/each}
        {/if}
      </li>
    {/each}
    {#each unclaimed as c (c.id)}
      <li class="rounded-control bg-surface px-2 py-1 text-muted">
        {c.name} · unclaimed, sits out
      </li>
    {/each}
  </ul>
{/if}
