<script module lang="ts">
  import type { ComponentProps } from 'svelte'
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import ProposalCard from './ProposalCard.svelte'
  import Button from './Button.svelte'

  const { Story } = defineMeta({
    title: 'UI/ProposalCard',
    component: ProposalCard,
    tags: ['autodocs'],
    args: { label: 'Premise', value: 'A fenland where the dead refuse to stay buried.' },
    argTypes: {
      status: { control: 'select', options: ['pending', 'accepted', 'dismissed', 'superseded'] }
    }
  })
</script>

{#snippet template(args: ComponentProps<typeof ProposalCard>)}
  <div class="max-w-md"><ProposalCard {...args} /></div>
{/snippet}

{#snippet actions()}
  <Button size="sm">Accept</Button>
  <Button size="sm" variant="secondary">Dismiss</Button>
{/snippet}

<Story name="Pending with actions" args={{ status: 'pending', actions }} {template} />
<Story name="Accepted" args={{ status: 'accepted' }} {template} />
<Story name="Dismissed" args={{ status: 'dismissed' }} {template} />
<Story name="Superseded" args={{ status: 'superseded' }} {template} />
