<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'

  type Props = {
    label: string
    hint?: string
    error?: string
    /** Receives the generated control id and the `aria-describedby` value (undefined when neither hint nor error shows). */
    children: Snippet<[id: string, describedby: string | undefined]>
  } & Omit<HTMLAttributes<HTMLDivElement>, 'children'>

  let { label, hint, error, class: className, children, ...rest }: Props = $props()

  const uid = $props.id()
  const id = `${uid}-control`
  const hintId = `${uid}-hint`
  const errorId = `${uid}-error`
  const describedby = $derived(
    [hint ? hintId : undefined, error ? errorId : undefined].filter(Boolean).join(' ') || undefined
  )
</script>

<div class={['space-y-1', className]} {...rest}>
  <label for={id} class="block text-sm font-medium text-text">{label}</label>
  {@render children(id, describedby)}
  {#if hint}
    <p id={hintId} class="text-sm text-muted">{hint}</p>
  {/if}
  {#if error}
    <p id={errorId} role="alert" class="text-sm font-medium text-danger">{error}</p>
  {/if}
</div>
