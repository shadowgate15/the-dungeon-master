<script lang="ts">
  import type { Spell } from '#lib/rules/schema.ts'
  import type { Snippet } from 'svelte'
  import SpellDetails from './SpellDetails.svelte'

  /**
   * A spell row with a "Details" disclosure. `row` is the row's own content (a pick label, or a
   * plain name); the button sits beside it, outside any label, so opening never changes a pick.
   * The expanded `SpellDetails` goes below the row. Open state is local and not saved.
   */
  let { spell, row, class: className }: { spell: Spell; row: Snippet; class?: string } = $props()

  const uid = $props.id()
  const panelId = `spell-details-${uid}`
  let open = $state(false)
</script>

<div class={className}>
  <div class="flex items-center gap-2">
    {@render row()}
    <button
      type="button"
      class="shrink-0 rounded-control border border-control-border px-2 py-0.5 text-sm hover:bg-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      aria-expanded={open}
      aria-controls={panelId}
      aria-label={`Details for ${spell.name}`}
      onclick={() => (open = !open)}
    >
      Details
    </button>
  </div>
  {#if open}
    <div class="mt-1">
      <SpellDetails {spell} id={panelId} />
    </div>
  {/if}
</div>
