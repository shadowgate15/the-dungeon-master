<script lang="ts">
  import { SvelteMap } from 'svelte/reactivity'
  import type { EntityType } from '#lib/world/entity-types.ts'
  import { holds, type JournalEntry } from './journal'

  /**
   * What the Player's Characters believe, grouped by who or what it is about, each entry marked
   * with the Characters who hold it. Only Beliefs, as learned: never the World layer.
   */
  let {
    entries,
    actor
  }: {
    entries: JournalEntry[]
    /**
     * The acting Character's id, for their view: their own entries go unmarked and the rest of
     * the Party's are marked with who holds them. Without it, every entry is marked.
     */
    actor?: string
  } = $props()

  const typeLabel: Record<EntityType, string> = {
    npc: 'Person',
    place: 'Place',
    faction: 'Faction',
    topic: 'Topic'
  }

  /** Entries grouped by what they are about, in the order first learned. */
  const groups = $derived.by(() => {
    const byAbout = new SvelteMap<
      string,
      { name: string; type: EntityType; entries: JournalEntry[] }
    >()
    for (const e of entries) {
      const key = `${e.about.type}:${e.about.name}`
      const group = byAbout.get(key) ?? { ...e.about, entries: [] }
      group.entries.push(e)
      byAbout.set(key, group)
    }
    return [...byAbout.values()]
  })
</script>

{#if groups.length === 0}
  <p class="text-sm text-muted">Nothing learned yet.</p>
{:else}
  <div class="flex flex-col gap-3">
    {#each groups as group (`${group.type}:${group.name}`)}
      <section aria-label={group.name}>
        <h3 class="flex items-baseline gap-2 text-sm font-semibold">
          {group.name}
          <span class="text-xs font-normal text-muted">{typeLabel[group.type]}</span>
        </h3>
        <ul class="mt-1 flex flex-col gap-1 text-sm">
          {#each group.entries as entry (entry.id)}
            <li>
              <span>{entry.text === group.name ? 'Heard of' : entry.text}</span>
              {#if entry.source}<span class="text-muted"> (from {entry.source})</span>{/if}
              {#if actor === undefined || !holds(entry, actor)}
                <span class="block text-xs text-muted"
                  >{entry.holders.map((h) => h.name).join(', ')}</span
                >
              {/if}
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  </div>
{/if}
