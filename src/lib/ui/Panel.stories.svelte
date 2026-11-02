<script module lang="ts">
  import type { ComponentProps } from 'svelte'
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import Panel from './Panel.svelte'

  const { Story } = defineMeta({
    title: 'UI/Panel',
    component: Panel,
    tags: ['autodocs'],
    args: { title: 'AI status' },
    argTypes: { level: { control: 'select', options: [2, 3, 4] } }
  })
</script>

{#snippet template(args: ComponentProps<typeof Panel>)}
  <div class="max-w-md">
    <Panel {...args}><p class="text-sm">The local model is ready.</p></Panel>
  </div>
{/snippet}

<Story name="Default" {template} />
<Story name="Level 3" args={{ level: 3 }} {template} />
<Story name="Level 4" args={{ level: 4 }} {template} />
