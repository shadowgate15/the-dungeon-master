<script module lang="ts">
  import type { ComponentProps } from 'svelte'
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import Dialog from './Dialog.svelte'

  const { Story } = defineMeta({
    title: 'UI/Dialog',
    component: Dialog,
    tags: ['autodocs'],
    args: { title: 'New World', closeHref: '/' }
  })
</script>

{#snippet template(args: ComponentProps<typeof Dialog>)}
  <Dialog {...args}>
    <p>Describe the world your campaign will take place in.</p>
  </Dialog>
{/snippet}

<Story name="Open" args={{ open: true }} {template} />
<Story name="Closed" args={{ open: false }} {template} />
