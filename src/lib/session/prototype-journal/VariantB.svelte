<script lang="ts">
  // PROTOTYPE B "Stacked rail": sheet stays on top, the journal sits below it in the same rail,
  // always visible, no tabs. People are cards with what they know nested inside; other kinds are
  // collapsed groups. A "Since you last played" strip leads with what changed.
  import type { Snippet } from 'svelte'
  import Button from '#lib/ui/Button.svelte'
  import { KINDS, byKind, unseen, type Entry } from './fixtures.ts'

  let {
    narrative,
    sheet,
    footer,
    entries
  }: { narrative: Snippet; sheet: Snippet; footer?: Snippet; entries: Entry[] } = $props()
  let drawerOpen = $state(false)
  const changed = $derived(unseen(entries))
  const people = $derived(byKind(entries, 'npc'))
</script>

{#snippet railBody()}
  <div class="space-y-5">
    {@render sheet()}
    <section aria-label="Journal" class="space-y-3 border-t border-border pt-3">
      <h2 class="font-display text-lg">Journal</h2>
      {#if entries.length === 0}
        <p class="text-sm text-muted">
          The Dungeon Master has not introduced anyone yet. Who you meet will be listed here.
        </p>
      {:else}
        {#if changed.length > 0}
          <div class="rounded-control bg-raised p-2 text-sm">
            <p class="font-medium">Changed since last time</p>
            <ul class="mt-1 list-disc pl-4 text-muted">
              {#each changed as x (x.id)}<li>
                  {x.name}{x.changeNote ? `: ${x.changeNote}` : ' (new)'}
                </li>{/each}
            </ul>
          </div>
        {/if}
        <div class="space-y-2">
          {#each people as p (p.id)}
            <div class="rounded-control border border-border p-2 text-sm">
              <div class="flex items-baseline justify-between gap-2">
                <span class="font-medium">{p.name}</span>
                <span class="text-xs text-muted"
                  >{p.stance}{p.status && p.status !== 'alive' ? ` · ${p.status}` : ''}</span
                >
              </div>
              <p class="text-muted">{p.summary}</p>
              {#if p.knows?.length}<p class="mt-1 text-xs text-muted">
                  Knows: {p.knows.join('; ')}
                </p>{/if}
            </div>
          {/each}
        </div>
        {#each KINDS.filter((k) => k.kind !== 'npc') as k (k.kind)}
          {@const list = byKind(entries, k.kind)}
          {#if list.length > 0}
            <details class="text-sm">
              <summary class="cursor-pointer py-1 text-xs font-medium text-muted uppercase"
                >{k.plural} · {list.length}</summary
              >
              <ul class="space-y-1.5 pl-1">
                {#each list as x (x.id)}
                  <li>
                    <span class="font-medium">{x.name}</span>{#if x.change}<span
                        class="ml-1 text-xs text-muted">•</span
                      >{/if}<br /><span class="text-muted">{x.summary}</span>
                  </li>
                {/each}
              </ul>
            </details>
          {/if}
        {/each}
      {/if}
    </section>
  </div>
{/snippet}

<div class="lg:grid lg:grid-cols-[1fr_22rem] lg:gap-6">
  <div class="space-y-3 pb-32">
    <div class="lg:hidden">
      <Button variant="secondary" size="sm" onclick={() => (drawerOpen = true)}
        >Sheet &amp; journal</Button
      >
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
    <div class="pointer-events-auto mx-auto max-w-6xl lg:grid lg:grid-cols-[1fr_22rem] lg:gap-6">
      <div class="rounded-control border border-border bg-surface/95 p-2 shadow-lg backdrop-blur">
        {@render footer()}
      </div>
    </div>
  </div>
{/if}
