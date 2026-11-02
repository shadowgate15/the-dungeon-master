<script module lang="ts">
  import type { ComponentProps } from 'svelte'
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import TextInput from './TextInput.svelte'

  const { Story } = defineMeta({
    title: 'UI/TextInput',
    component: TextInput,
    tags: ['autodocs'],
    argTypes: { size: { control: 'select', options: ['sm', 'md'] } }
  })
</script>

{#snippet template(args: ComponentProps<typeof TextInput>)}
  <label class="block max-w-sm space-y-1 text-sm">
    Name
    <TextInput {...args} />
  </label>
{/snippet}

<Story name="Default" args={{ placeholder: 'Eldoria' }} {template} />
<Story name="Filled" args={{ value: 'Eldoria' }} {template} />
<Story name="Small" args={{ size: 'sm', value: 'Eldoria' }} {template} />
<Story name="Disabled" args={{ disabled: true, value: 'Eldoria' }} {template} />
