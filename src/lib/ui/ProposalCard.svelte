<script lang="ts" module>
  export type ProposalStatus = 'pending' | 'accepted' | 'dismissed' | 'superseded'
</script>

<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'
  import Badge, { type BadgeVariant } from './Badge.svelte'

  type Props = {
    label: string
    value: string
    status?: ProposalStatus
    actions?: Snippet
  } & Omit<HTMLAttributes<HTMLDivElement>, 'children'>

  let { label, value, status = 'pending', actions, class: className, ...rest }: Props = $props()

  const badges: Record<ProposalStatus, BadgeVariant> = {
    pending: 'info',
    accepted: 'success',
    dismissed: 'neutral',
    superseded: 'warning'
  }
</script>

<div
  class={[
    'space-y-2 rounded-panel border border-border bg-raised p-3 text-sm text-text',
    className
  ]}
  {...rest}
>
  <div class="flex items-center justify-between gap-2">
    <span class="font-medium text-muted">{label}</span>
    {#if status !== 'pending'}
      <Badge variant={badges[status]} size="sm">{status}</Badge>
    {/if}
  </div>
  <p class="whitespace-pre-wrap">{value}</p>
  {#if actions}
    <div class="flex gap-2">{@render actions()}</div>
  {/if}
</div>
