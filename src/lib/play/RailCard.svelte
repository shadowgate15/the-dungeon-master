<script lang="ts">
  import type { Snippet } from 'svelte'

  /**
   * A card in the play console's right rail: a pinned header over a body that, on a wide screen,
   * scrolls inside the card. It shrinks to share the rail's height but not below 8rem, or its
   * content height when that is less. (`calc-size` is Chromium-only; elsewhere the floor is 0.)
   */
  let {
    id,
    label,
    heading,
    headingClass,
    body = $bindable(),
    children
  }: {
    /** The heading's id, which names the card and its scrolling body. */
    id: string
    /** The card's accessible name, when it is not the heading's text. */
    label?: string
    heading: Snippet
    headingClass: string
    /** The scrolling body, for a card that scrolls its own content into view. */
    body?: HTMLElement
    children: Snippet
  } = $props()
</script>

<section
  aria-label={label}
  aria-labelledby={label ? undefined : id}
  class="flex flex-col overflow-hidden rounded-panel border border-border bg-surface lg:[min-height:calc-size(max-content,min(size,8rem))]"
>
  <h2 {id} class={['shrink-0 px-3 pt-3 pb-1', headingClass]}>{@render heading()}</h2>
  <!-- A scroll region: focusable so keyboard users can scroll it (axe scrollable-region-focusable). -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div
    bind:this={body}
    role="group"
    aria-labelledby={id}
    tabindex="0"
    data-testid="rail-card-body"
    class="min-h-0 px-3 pb-3 lg:overflow-y-auto"
  >
    {@render children()}
  </div>
</section>
