<script module lang="ts">
  import type { ComponentProps } from 'svelte'
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import Select from './Select.svelte'

  const { Story } = defineMeta({
    title: 'UI/Select',
    component: Select,
    tags: ['autodocs'],
    argTypes: { size: { control: 'select', options: ['sm', 'md'] } }
  })
</script>

{#snippet template(args: ComponentProps<typeof Select>)}
  <label class="block max-w-sm space-y-1 text-sm">
    Genre
    <Select {...args}>
      <option value="fantasy">Fantasy</option>
      <option value="horror">Horror</option>
      <option value="mystery">Mystery</option>
    </Select>
  </label>
{/snippet}

<Story name="Default" {template} />
<Story name="Selected" args={{ value: 'horror' }} {template} />
<Story name="Small" args={{ size: 'sm' }} {template} />
<Story name="Disabled" args={{ disabled: true }} {template} />
