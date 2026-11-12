<script lang="ts">
  // PROTOTYPE A "Rail tabs": the rail (and the drawer) get two tabs, Sheet | Journal. Journal is
  // grouped by kind, one flat list per group; each row expands in place. "New"/"Updated" chips
  // stay until the tab has been opened, then fade to a dot-free state (simulated by local state).
  import type { Snippet } from 'svelte'
  import Button from '#lib/ui/Button.svelte'
  import { KINDS, byKind, unseen, type Entry } from './fixtures.ts'

  let {
    narrative,
    sheet,
    footer,
    entries
  }: { narrative: Snippet; sheet: Snippet; footer?: Snippet; entries: Entry[] } = $props()

  let tab = $state<'sheet' | 'journal'>('sheet')
  let drawerOpen = $state(false)
  let seen = $state(false)
  const fresh = $derived(seen ? 0 : unseen(entries).length)
  function show(t: 'sheet' | 'journal') {
    tab = t
    if (t === 'journal') seen = true
  }
</script>

{#snippet railBody()}
  <div role="tablist" class="mb-3 flex gap-1 border-b border-border">
    <button
      role="tab"
      aria-selected={tab === 'sheet'}
      class="px-3 py-1.5 text-sm {tab === 'sheet'
        ? 'border-b-2 border-primary font-medium'
        : 'text-muted'}"
      onclick={() => show('sheet')}>Sheet</button
    >
    <button
      role="tab"
      aria-selected={tab === 'journal'}
      class="px-3 py-1.5 text-sm {tab === 'journal'
        ? 'border-b-2 border-primary font-medium'
        : 'text-muted'}"
      onclick={() => show('journal')}
    >
      Journal{#if fresh > 0}<span
          class="ml-1 rounded-full bg-primary px-1.5 text-xs text-on-primary">{fresh}</span
        >{/if}
    </button>
  </div>
  {#if tab === 'sheet'}
    {@render sheet()}
  {:else if entries.length === 0}
    <div class="rounded-control border border-dashed border-border p-3 text-sm text-muted">
      <p class="font-medium text-text">Nothing noted yet.</p>
      <p>
        People, places and facts the Dungeon Master introduces will be recorded here as you play.
      </p>
    </div>
  {:else}
    <div class="space-y-4">
      {#each KINDS as k (k.kind)}
        {@const list = byKind(entries, k.kind)}
        {#if list.length > 0}
          <section>
            <h3 class="mb-1 text-xs font-medium text-muted uppercase">
              {k.plural} · {list.length}
            </h3>
            <ul class="divide-y divide-border">
              {#each list as x (x.id)}
                <li>
                  <details>
                    <summary
                      class="flex cursor-pointer items-center justify-between gap-2 py-1.5 text-sm"
                    >
                      <span
                        >{x.name}{#if x.status && x.status !== 'alive'}
                          <em class="text-muted">({x.status})</em>{/if}</span
                      >
                      {#if x.change && !seen}<span class="rounded bg-raised px-1 text-xs"
                          >{x.change === 'new' ? 'New' : 'Updated'}</span
                        >{/if}
                    </summary>
                    <div class="pb-2 text-sm text-muted">
                      <p>{x.summary}</p>
                      {#if x.stance}<p>
                          Toward you: {x.stance}{x.stanceNote ? ` — ${x.stanceNote}` : ''}
                        </p>{/if}
                      {#if x.changeNote}<p>Changed: {x.changeNote}</p>{/if}
                    </div>
                  </details>
                </li>
              {/each}
            </ul>
          </section>
        {/if}
      {/each}
    </div>
  {/if}
{/snippet}

<div class="lg:grid lg:grid-cols-[1fr_20rem] lg:gap-6">
  <div class="space-y-3 pb-32">
    <div class="lg:hidden">
      <Button variant="secondary" size="sm" onclick={() => (drawerOpen = true)}>
        Sheet &amp; journal{#if fresh > 0}
          · {fresh} new{/if}
      </Button>
    </div>
    {@render narrative()}
  </div>
  <aside
    aria-label="Rail"
    class="sticky top-4 hidden h-fit max-h-[calc(100vh-2rem)] overflow-y-auto lg:block"
  >
    {@render railBody()}
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
      aria-label="Drawer"
      class="fixed inset-y-0 right-0 z-30 w-80 max-w-full overflow-y-auto border-l border-border bg-surface p-4 shadow-lg"
    >
      <Button variant="ghost" size="sm" onclick={() => (drawerOpen = false)}>Close</Button>
      {@render railBody()}
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
