<script lang="ts">
  import type { MemoryKind } from '#lib/memory/enums.ts'
  import {
    JOURNAL_KINDS,
    chipLabel,
    entriesOfKind,
    groupBySession,
    type JournalEntry
  } from '#lib/memory/journal.ts'
  import Button from '#lib/ui/Button.svelte'

  /**
   * The read-only Journal: an index of kinds beside the entries, grouped by the Session they
   * first appeared in, newest first. Full-screen on narrow windows. Chips come from the entries
   * as given; clearing them is the caller's job, on close.
   */
  let { entries, onclose }: { entries: JournalEntry[]; onclose: () => void } = $props()

  let filter = $state<MemoryKind | 'all'>('all')
  const groups = $derived(groupBySession(entriesOfKind(entries, filter)))
  const latest = $derived(Math.max(0, ...entries.map((e) => e.session)))
  const index = $derived([
    { kind: 'all' as const, label: 'Everything', count: entries.length },
    ...JOURNAL_KINDS.map(({ kind, plural }) => ({
      kind,
      label: plural,
      count: entriesOfKind(entries, kind).length
    }))
  ])
  const meta = (e: JournalEntry) =>
    [JOURNAL_KINDS.find((k) => k.kind === e.kind)?.label, e.role, e.status, e.stance]
      .filter(Boolean)
      .join(' · ')
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<div
  role="dialog"
  aria-modal="true"
  aria-label="Journal"
  class="fixed inset-0 z-40 flex items-stretch justify-center bg-black/50 sm:p-8"
>
  <div
    class="flex w-full max-w-4xl flex-col overflow-hidden bg-surface shadow-xl sm:rounded-control sm:border sm:border-border"
  >
    <header class="flex items-center justify-between border-b border-border p-3">
      <h2 class="font-display text-lg">Journal</h2>
      <Button variant="ghost" size="sm" onclick={onclose}>Close</Button>
    </header>
    {#if entries.length === 0}
      <div class="m-auto max-w-xs p-6 text-center text-muted">
        <p class="font-medium text-text">A blank page.</p>
        <p class="text-sm">
          Everything the Dungeon Master tells you of this world that matters gets written here.
        </p>
      </div>
    {:else}
      <div class="flex min-h-0 flex-1 flex-col sm:flex-row">
        <nav
          aria-label="Journal index"
          class="flex gap-1 overflow-x-auto border-b border-border p-2 sm:w-40 sm:flex-col sm:border-r sm:border-b-0"
        >
          {#each index as item (item.kind)}
            <button
              type="button"
              aria-pressed={filter === item.kind}
              class="rounded-control px-2 py-1 text-left text-sm whitespace-nowrap {filter ===
              item.kind
                ? 'bg-raised font-medium'
                : 'text-muted'}"
              onclick={() => (filter = item.kind)}
            >
              {item.label} ({item.count})
            </button>
          {/each}
        </nav>
        <div class="flex-1 space-y-5 overflow-y-auto p-4">
          {#each groups as group (group.session)}
            <section aria-label="Session {group.session}">
              <h3 class="mb-2 text-xs font-medium text-muted uppercase">
                Session {group.session}{group.session === latest ? ' · latest' : ''}
              </h3>
              <ul class="space-y-3">
                {#each group.entries as e (e.id)}
                  <li class="max-w-prose">
                    <div class="flex flex-wrap items-baseline gap-2">
                      <span class="font-medium">{e.name}</span>
                      <span class="text-xs text-muted">{meta(e)}</span>
                      {#if e.chip}
                        <span class="rounded bg-raised px-1 text-xs">{chipLabel(e.chip)}</span>
                      {/if}
                    </div>
                    {#if e.summary}<p class="text-sm text-muted">{e.summary}</p>{/if}
                    {#if e.knows?.length}
                      <p class="text-xs text-muted">Knows: {e.knows.join('; ')}</p>
                    {/if}
                  </li>
                {/each}
              </ul>
            </section>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</div>
