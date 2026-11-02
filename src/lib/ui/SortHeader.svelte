<script lang="ts" module>
  export type SortDirection = 'ascending' | 'descending'
</script>

<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { HTMLThAttributes } from 'svelte/elements'

  type Props = {
    /** Current sort direction of this column; omit when not sorted by it. */
    sort?: SortDirection
    onsort?: () => void
    children?: Snippet
  } & Omit<HTMLThAttributes, 'children' | 'aria-sort'>

  let { sort, onsort, class: className, children, ...rest }: Props = $props()
</script>

<th aria-sort={sort} class={['p-2 font-medium', className]} {...rest}>
  <button
    type="button"
    class="inline-flex items-center gap-1 rounded-control hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    onclick={() => onsort?.()}
  >
    {@render children?.()}
    {#if sort}<span aria-hidden="true">{sort === 'ascending' ? '▲' : '▼'}</span>{/if}
  </button>
</th>
