<script module lang="ts">
  import type { ComponentProps } from 'svelte'
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import ChatBubble from './ChatBubble.svelte'

  const { Story } = defineMeta({
    title: 'UI/ChatBubble',
    component: ChatBubble,
    tags: ['autodocs'],
    argTypes: { role: { control: 'select', options: ['user', 'assistant'] } }
  })
</script>

{#snippet template(args: ComponentProps<typeof ChatBubble>)}
  <div class="flex max-w-xl flex-col">
    <ChatBubble {...args}>A misty fenland ruled by rival witch covens.</ChatBubble>
  </div>
{/snippet}

<Story name="User" args={{ role: 'user' }} {template} />
<Story name="Assistant" args={{ role: 'assistant' }} {template} />
<Story name="Error" args={{ role: 'assistant', error: true }} {template} />
