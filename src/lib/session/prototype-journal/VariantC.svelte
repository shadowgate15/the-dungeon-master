<script lang="ts">
  // PROTOTYPE C "Journal book": the rail stays sheet-only. A "Journal" button in the page header
  // (with an unseen count) opens a full overlay, a book: index of kinds on the left, entries
  // grouped by the Session they appeared in on the right, newest Session first. Full-screen on
  // narrow windows, so it needs no separate drawer treatment.
  import type { Snippet } from 'svelte'
  import Button from '#lib/ui/Button.svelte'
  import { KINDS, byKind, unseen, type Entry, type Kind } from './fixtures.ts'

  let {
    narrative,
    sheet,
    footer,
    entries
  }: { narrative: Snippet; sheet: Snippet; footer?: Snippet; entries: Entry[] } = $props()
  let open = $state(false)
  let drawerOpen = $state(false)
  let filter = $state<Kind | 'all'>('all')
  const fresh = $derived(unseen(entries).length)
  const shown = $derived(filter === 'all' ? entries : byKind(entries, filter))
  const sessions = $derived([...new Set(shown.map((x) => x.session))].sort((a, b) => b - a))
</script>

<div class="lg:grid lg:grid-cols-[1fr_20rem] lg:gap-6">
  <div class="space-y-3 pb-32">
    <div class="flex gap-2">
      <Button variant="secondary" size="sm" class="lg:hidden" onclick={() => (drawerOpen = true)}
        >Character sheet</Button
      >
      <Button variant="secondary" size="sm" onclick={() => (open = true)}>
        📖 Journal{#if fresh > 0}
          · {fresh} new{/if}
      </Button>
    </div>
    {@render narrative()}
  </div>
  <aside aria-label="Character sheet rail" class="sticky top-4 hidden h-fit lg:block">
    {@render sheet()}
  </aside>
</div>

{#if drawerOpen}
  <div class="lg:hidden">
    <button
      type="button"
      aria-label="Close"
      class="fixed inset-0 z-20 bg-black/40"
      onclick={() => (drawerOpen = false)}
    ></button>
    <div
      role="dialog"
      aria-label="Sheet drawer"
      class="fixed inset-y-0 right-0 z-30 w-80 max-w-full overflow-y-auto border-l border-border bg-surface p-4 shadow-lg"
    >
      <Button variant="ghost" size="sm" onclick={() => (drawerOpen = false)}>Close</Button>
      {@render sheet()}
    </div>
  </div>
{/if}

{#if open}
  <div
    role="dialog"
    aria-label="Journal"
    class="fixed inset-0 z-40 flex items-stretch justify-center bg-black/50 sm:p-8"
  >
    <div
      class="flex w-full max-w-4xl flex-col overflow-hidden bg-surface shadow-xl sm:rounded-control sm:border sm:border-border"
    >
      <header class="flex items-center justify-between border-b border-border p-3">
        <h2 class="font-display text-lg">Journal</h2>
        <Button variant="ghost" size="sm" onclick={() => (open = false)}>Close</Button>
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
            class="flex gap-1 overflow-x-auto border-b border-border p-2 sm:w-40 sm:flex-col sm:border-r sm:border-b-0"
          >
            {#each [{ kind: 'all', plural: 'Everything' }, ...KINDS] as k (k.kind)}
              <button
                class="rounded-control px-2 py-1 text-left text-sm whitespace-nowrap {filter ===
                k.kind
                  ? 'bg-raised font-medium'
                  : 'text-muted'}"
                onclick={() => (filter = k.kind as Kind | 'all')}
              >
                {k.plural}{k.kind !== 'all' ? ` (${byKind(entries, k.kind as Kind).length})` : ''}
              </button>
            {/each}
          </nav>
          <div class="flex-1 space-y-5 overflow-y-auto p-4">
            {#each sessions as s (s)}
              <section>
                <h3 class="mb-2 text-xs font-medium text-muted uppercase">
                  Session {s}{s === Math.max(...entries.map((x) => x.session)) ? ' · latest' : ''}
                </h3>
                <ul class="space-y-3">
                  {#each shown.filter((x) => x.session === s) as x (x.id)}
                    <li class="max-w-prose">
                      <div class="flex items-baseline gap-2">
                        <span class="font-medium">{x.name}</span>
                        <span class="text-xs text-muted"
                          >{KINDS.find((k) => k.kind === x.kind)?.label}{x.status
                            ? ` · ${x.status}`
                            : ''}{x.stance ? ` · ${x.stance}` : ''}</span
                        >
                        {#if x.change}<span class="rounded bg-raised px-1 text-xs"
                            >{x.change === 'new' ? 'New' : `Updated: ${x.changeNote}`}</span
                          >{/if}
                      </div>
                      <p class="text-sm text-muted">{x.summary}</p>
                      {#if x.knows?.length}<p class="text-xs text-muted">
                          Knows: {x.knows.join('; ')}
                        </p>{/if}
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
{/if}

{#if footer}
  <div class="pointer-events-none fixed inset-x-0 bottom-0 z-10 px-6 pb-4">
    <div class="pointer-events-auto mx-auto max-w-6xl lg:grid lg:grid-cols-[1fr_20rem] lg:gap-6">
      <div class="rounded-control border border-border bg-surface/95 p-2 shadow-lg backdrop-blur">
        {@render footer()}
      </div>
    </div>
  </div>
{/if}
