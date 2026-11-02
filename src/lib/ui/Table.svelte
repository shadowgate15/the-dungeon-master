<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { HTMLTableAttributes } from 'svelte/elements'

  type Props = {
    children?: Snippet
    /** Shown below the table; pass it only when there are no rows. */
    empty?: Snippet
  } & Omit<HTMLTableAttributes, 'children'>

  let { class: className, children, empty, ...rest }: Props = $props()
</script>

<div class="overflow-x-auto rounded-panel border border-border bg-surface shadow-raised">
  <table class={['w-full border-collapse text-left text-sm text-text', className]} {...rest}>
    {@render children?.()}
  </table>
  {#if empty}
    <div class="p-6 text-center text-muted">{@render empty()}</div>
  {/if}
</div>
