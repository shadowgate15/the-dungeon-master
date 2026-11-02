<script module lang="ts">
  import type { ComponentProps } from 'svelte'
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import Alert from './Alert.svelte'

  const { Story } = defineMeta({
    title: 'UI/Alert',
    component: Alert,
    tags: ['autodocs'],
    argTypes: { variant: { control: 'select', options: ['info', 'success', 'warning', 'danger'] } }
  })
</script>

{#snippet template(args: ComponentProps<typeof Alert>)}
  <Alert {...args}>The model is unreachable. Check the provider settings.</Alert>
{/snippet}

<Story name="Info" args={{ variant: 'info' }} {template} />
<Story name="Success" args={{ variant: 'success' }} {template} />
<Story name="Warning" args={{ variant: 'warning' }} {template} />
<Story name="Danger" args={{ variant: 'danger' }} {template} />
