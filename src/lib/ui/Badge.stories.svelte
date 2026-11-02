<script module lang="ts">
  import type { ComponentProps } from 'svelte'
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import Badge from './Badge.svelte'

  const { Story } = defineMeta({
    title: 'UI/Badge',
    component: Badge,
    tags: ['autodocs'],
    argTypes: {
      variant: { control: 'select', options: ['neutral', 'info', 'success', 'warning', 'danger'] },
      size: { control: 'select', options: ['sm', 'md'] }
    }
  })
</script>

{#snippet template(args: ComponentProps<typeof Badge>)}
  <Badge {...args}>Ready</Badge>
{/snippet}

<Story name="Neutral" args={{ variant: 'neutral' }} {template} />
<Story name="Info" args={{ variant: 'info' }} {template} />
<Story name="Success" args={{ variant: 'success' }} {template} />
<Story name="Warning" args={{ variant: 'warning' }} {template} />
<Story name="Danger" args={{ variant: 'danger' }} {template} />
<Story name="Small" args={{ size: 'sm' }} {template} />
