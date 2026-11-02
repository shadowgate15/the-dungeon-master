<script lang="ts" module>
  export type ChatRole = 'user' | 'assistant'
</script>

<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'

  type Props = {
    role: ChatRole
    /** Marks an assistant turn that failed. */
    error?: boolean
    children?: Snippet
  } & Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'role'>

  let { role, error = false, class: className, children, ...rest }: Props = $props()

  const tone = $derived(
    error
      ? 'border-danger bg-danger-bg text-danger'
      : role === 'user'
        ? 'ml-auto border-transparent bg-primary text-on-primary'
        : 'mr-auto border-border bg-raised text-text'
  )
</script>

<div
  data-role={role}
  class={[
    'max-w-[85%] rounded-panel border px-4 py-2 text-sm whitespace-pre-wrap',
    tone,
    className
  ]}
  {...rest}
>
  {@render children?.()}
</div>
