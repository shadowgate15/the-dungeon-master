<script module lang="ts">
  import type { ComponentProps } from 'svelte'
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import Field from './Field.svelte'
  import TextInput from './TextInput.svelte'

  const { Story } = defineMeta({
    title: 'UI/Field',
    component: Field,
    tags: ['autodocs']
  })
</script>

{#snippet template(args: ComponentProps<typeof Field>)}
  <div class="max-w-sm">
    <Field {...args}>
      {#snippet children(id, describedby)}
        <TextInput {id} name="name" aria-describedby={describedby} aria-invalid={!!args.error} />
      {/snippet}
    </Field>
  </div>
{/snippet}

<Story name="Default" args={{ label: 'Name' }} {template} />
<Story name="With hint" args={{ label: 'Name', hint: 'Shown in the worlds list' }} {template} />
<Story name="With error" args={{ label: 'Name', error: 'Name is required' }} {template} />
<Story
  name="Hint and error"
  args={{ label: 'Name', hint: 'Shown in the worlds list', error: 'Name is required' }}
  {template}
/>
