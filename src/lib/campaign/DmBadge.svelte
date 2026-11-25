<script lang="ts">
  import Badge from '#lib/ui/Badge.svelte'

  type Props = {
    /** Whether a Claude Code session is attached to the Campaign. */
    attached: boolean
    size?: 'sm' | 'md'
  }

  let { attached, size = 'md' }: Props = $props()
</script>

<Badge variant={attached ? 'success' : 'neutral'} {size}>
  {attached ? 'DM at the table' : 'DM away'}
</Badge>
