<script lang="ts">
  import type { Journal } from '#lib/memory/journal.ts'
  import Badge from '#lib/ui/Badge.svelte'

  type Props = { journal: Journal }

  let { journal }: Props = $props()

  const KINDS = [
    { key: 'people', label: 'People' },
    { key: 'places', label: 'Places' },
    { key: 'facts', label: 'Facts' }
  ] as const
  let kind = $state<(typeof KINDS)[number]['key']>('people')
</script>

<!-- Read-only: pure code over World memory. NPCs show name, role, status and stance only. -->
<div class="space-y-3">
  <div role="tablist" aria-label="Journal kinds" class="flex gap-2">
    {#each KINDS as k (k.key)}
      <button
        type="button"
        role="tab"
        id="journal-tab-{k.key}"
        aria-selected={kind === k.key}
        aria-controls="journal-panel"
        onclick={() => (kind = k.key)}
        class={[
          'rounded-control border border-control-border px-3 py-1.5 text-sm font-medium',
          kind === k.key ? 'bg-primary text-on-primary' : 'bg-raised text-text hover:bg-surface'
        ]}>{k.label}</button
      >
    {/each}
  </div>

  <div role="tabpanel" id="journal-panel" aria-labelledby="journal-tab-{kind}" class="space-y-4">
    {#if journal[kind].length === 0}
      <p class="text-sm text-muted">Nothing here yet.</p>
    {/if}
    {#each journal[kind] as g (g.sessionId)}
      <section class="space-y-1">
        <h3 class="font-display text-base">Session {g.sessionNumber}</h3>
        <ul class="space-y-1">
          {#each g.entries as e (e.id)}
            <li class="rounded-control border border-border bg-raised px-3 py-2 text-sm">
              {#if 'role' in e}
                <span class="font-medium">{e.name}</span>
                <span class="text-muted">{e.role}</span>
                <Badge size="sm" variant={e.status === 'alive' ? 'success' : 'neutral'}
                  >{e.status}</Badge
                >
                <Badge size="sm">{e.stance}</Badge>
              {:else if 'description' in e}
                <span class="font-medium">{e.name}</span>
                <p class="text-muted">{e.description}</p>
              {:else}
                <span class="font-medium">{e.title}</span>
                <p class="text-muted">{e.detail}</p>
              {/if}
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  </div>
</div>
