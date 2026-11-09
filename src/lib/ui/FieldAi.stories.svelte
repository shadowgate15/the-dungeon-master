<script module lang="ts">
  import type { ComponentProps } from 'svelte'
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import FieldAi from './FieldAi.svelte'

  const { Story } = defineMeta({
    title: 'UI/FieldAi',
    component: FieldAi,
    tags: ['autodocs'],
    argTypes: {
      kind: { control: 'inline-radio', options: ['text', 'textarea', 'enum'] },
      status: { control: 'inline-radio', options: ['idle', 'loading', 'error'] }
    },
    args: {
      label: 'Premise',
      kind: 'textarea',
      value: 'A drowned kingdom whose tides keep the old oaths.',
      status: 'idle',
      onGenerate: () => {},
      onFeedback: () => {},
      onStop: () => {},
      onRetry: () => {},
      onDismiss: () => {},
      onUndo: () => {}
    }
  })

  const races = [
    { value: 'dwarf', label: 'Dwarf' },
    { value: 'elf', label: 'Elf' },
    { value: 'human', label: 'Human' }
  ]
</script>

{#snippet template(args: ComponentProps<typeof FieldAi>)}
  <div class="max-w-md p-4 pb-40">
    <FieldAi {...args} />
  </div>
{/snippet}

<Story name="Text" args={{ label: 'Name', kind: 'text', value: 'Marrowgate' }} {template} />
<Story name="Textarea" {template} />
<Story
  name="Enum (Rules Data)"
  args={{ label: 'Race', kind: 'enum', value: 'elf', options: races }}
  {template}
/>
<Story name="Empty" args={{ value: '' }} {template} />
<Story name="Loading with Stop" args={{ status: 'loading' }} {template} />
<Story
  name="Loading enum"
  args={{ label: 'Race', kind: 'enum', value: 'elf', options: races, status: 'loading' }}
  {template}
/>
<Story
  name="Error with Retry"
  args={{ status: 'error', error: 'The model returned something unusable. Try again.' }}
  {template}
/>
<Story
  name="Error without Retry"
  args={{ status: 'error', retryable: false, error: 'A chosen World is archived or missing.' }}
  {template}
/>
<Story name="Updated by AI with Undo" args={{ canUndo: true }} {template} />
<Story
  name="Disabled: AI offline"
  args={{ disabledReason: 'AI is offline. Start LM Studio to use this.' }}
  {template}
/>
<Story
  name="Disabled: reasoning model"
  args={{
    disabledReason:
      'This model reasons before answering and is not supported. Pick another model and check the connection.'
  }}
  {template}
/>
<Story
  name="Disabled: no legal options"
  args={{
    label: 'Class spells',
    kind: 'enum',
    value: '',
    options: [],
    disabledReason: 'Choose a class first'
  }}
  {template}
/>
<Story
  name="Disabled: archived"
  args={{ readonly: true, disabledReason: 'Archived. Restore it to edit.' }}
  {template}
/>
