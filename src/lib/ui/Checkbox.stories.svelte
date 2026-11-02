<script module lang="ts">
  import type { ComponentProps } from 'svelte'
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import Checkbox from './Checkbox.svelte'

  const { Story } = defineMeta({
    title: 'UI/Checkbox',
    component: Checkbox,
    tags: ['autodocs']
  })
</script>

{#snippet template(args: ComponentProps<typeof Checkbox>)}
  <label class="flex items-center gap-2 text-sm">
    <Checkbox {...args} />
    Select world
  </label>
{/snippet}

<Story name="Unchecked" {template} />
<Story name="Checked" args={{ checked: true }} {template} />
<Story name="Disabled" args={{ disabled: true }} {template} />
<Story name="Disabled checked" args={{ disabled: true, checked: true }} {template} />
