<script lang="ts" module>
  import type { Status } from './status.ts'
  export type AlertVariant = Status
</script>

<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'
  import { STATUS_CLASSES } from './status.ts'

  type Props = {
    variant?: AlertVariant
    children?: Snippet
  } & Omit<HTMLAttributes<HTMLDivElement>, 'children'>

  let { variant = 'info', class: className, children, ...rest }: Props = $props()

  // Urgent variants interrupt; informational ones are announced politely.
  const role = $derived(variant === 'danger' || variant === 'warning' ? 'alert' : 'status')
</script>

<div
  {role}
  class={['rounded-control border px-3 py-2 text-sm', STATUS_CLASSES[variant], className]}
  {...rest}
>
  {@render children?.()}
</div>
