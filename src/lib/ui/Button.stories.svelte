<script module lang="ts">
  import type { ComponentProps } from 'svelte'
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import Button from './Button.svelte'

  const { Story } = defineMeta({
    title: 'UI/Button',
    component: Button,
    tags: ['autodocs'],
    argTypes: {
      variant: { control: 'select', options: ['primary', 'secondary', 'danger', 'ghost'] },
      size: { control: 'select', options: ['sm', 'md'] }
    }
  })
</script>

{#snippet template(args: ComponentProps<typeof Button>)}
  <Button {...args}>Roll initiative</Button>
{/snippet}

<Story name="Primary" args={{ variant: 'primary' }} {template} />
<Story name="Secondary" args={{ variant: 'secondary' }} {template} />
<Story name="Danger" args={{ variant: 'danger' }} {template} />
<Story name="Ghost" args={{ variant: 'ghost' }} {template} />
<Story name="Small" args={{ size: 'sm' }} {template} />
<Story name="Disabled" args={{ disabled: true }} {template} />
<Story name="As link" args={{ href: '/worlds' }} {template} />
