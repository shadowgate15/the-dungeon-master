<script module lang="ts">
  import type { ComponentProps } from 'svelte'
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import Toast from './Toast.svelte'

  const { Story } = defineMeta({
    title: 'UI/Toast',
    component: Toast,
    tags: ['autodocs'],
    argTypes: {
      tone: { control: 'select', options: ['neutral', 'info', 'success', 'warning', 'danger'] }
    }
  })
</script>

{#snippet template(args: ComponentProps<typeof Toast>)}
  <Toast {...args}><span>World archived</span></Toast>
{/snippet}

<Story name="Neutral" args={{ tone: 'neutral' }} {template} />
<Story name="Info" args={{ tone: 'info' }} {template} />
<Story name="Success" args={{ tone: 'success' }} {template} />
<Story name="Warning" args={{ tone: 'warning' }} {template} />
<Story name="Danger" args={{ tone: 'danger' }} {template} />
<Story name="Dismissable" args={{ onclose: () => {} }} {template} />
