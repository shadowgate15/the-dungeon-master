<script module lang="ts">
  import type { ComponentProps } from 'svelte'
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import Meter from './Meter.svelte'

  const { Story } = defineMeta({
    title: 'UI/Meter',
    component: Meter,
    tags: ['autodocs'],
    args: { label: 'Context', limit: 4096 }
  })
</script>

{#snippet template(args: ComponentProps<typeof Meter>)}
  <div class="max-w-sm"><Meter {...args} /></div>
{/snippet}

<Story name="Empty" args={{ used: 0 }} {template} />
<Story name="Half" args={{ used: 2048 }} {template} />
<Story name="Warning" args={{ used: 3500, warn: true }} {template} />
<Story name="Full" args={{ used: 4096, warn: true }} {template} />
<Story name="Over limit (clamped)" args={{ used: 5000, warn: true }} {template} />
