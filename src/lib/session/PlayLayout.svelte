<script lang="ts">
  import type { Snippet } from 'svelte'
  import Button from '#lib/ui/Button.svelte'

  /**
   * The play screen shell: a narrative column beside a sticky sheet rail on wide windows, and the
   * same sheet in a slide-over drawer on narrow ones. `footer` is pinned to the bottom of the
   * viewport, floating over the history.
   */
  type Props = {
    narrative: Snippet
    sheet: Snippet
    footer?: Snippet
  }

  let { narrative, sheet, footer }: Props = $props()

  let drawerOpen = $state(false)
</script>

<div class="lg:grid lg:grid-cols-[1fr_20rem] lg:gap-6">
  <div class="space-y-3 pb-32">
    <div class="lg:hidden">
      <Button
        variant="secondary"
        size="sm"
        aria-expanded={drawerOpen}
        aria-controls="sheet-drawer"
        onclick={() => (drawerOpen = true)}>Character sheet</Button
      >
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
      aria-label="Close Character sheet"
      class="fixed inset-0 z-20 bg-black/40"
      onclick={() => (drawerOpen = false)}
    ></button>
    <div
      id="sheet-drawer"
      role="dialog"
      aria-label="Character sheet drawer"
      class="fixed inset-y-0 right-0 z-30 w-80 max-w-full space-y-3 overflow-y-auto border-l border-border bg-surface p-4 shadow-lg"
    >
      <Button variant="ghost" size="sm" onclick={() => (drawerOpen = false)}>Close</Button>
      {@render sheet()}
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
