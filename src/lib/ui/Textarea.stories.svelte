<script module lang="ts">
  import type { ComponentProps } from 'svelte'
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import Textarea from './Textarea.svelte'

  const { Story } = defineMeta({
    title: 'UI/Textarea',
    component: Textarea,
    tags: ['autodocs'],
    argTypes: { size: { control: 'select', options: ['sm', 'md'] } }
  })
</script>

{#snippet template(args: ComponentProps<typeof Textarea>)}
  <label class="block max-w-sm space-y-1 text-sm">
    Premise
    <Textarea rows={3} {...args} />
  </label>
{/snippet}

<Story name="Default" args={{ placeholder: 'A haunted keep above the fog' }} {template} />
<Story name="Filled" args={{ value: 'A haunted keep above the fog.' }} {template} />
<Story name="Small" args={{ size: 'sm', value: 'A haunted keep.' }} {template} />
<Story name="Disabled" args={{ disabled: true, value: 'A haunted keep.' }} {template} />
