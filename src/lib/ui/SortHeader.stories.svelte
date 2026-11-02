<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import Table from './Table.svelte'
  import SortHeader from './SortHeader.svelte'

  const { Story } = defineMeta({
    title: 'UI/SortHeader',
    component: SortHeader,
    tags: ['autodocs']
  })
</script>

{#snippet sample(sort?: 'ascending' | 'descending')}
  <Table>
    <thead class="border-b border-border">
      <tr>
        <SortHeader {sort}>Name</SortHeader>
        <SortHeader>Campaigns</SortHeader>
      </tr>
    </thead>
    <tbody>
      <tr><td class="p-2">Eldermoor</td><td class="p-2">2</td></tr>
    </tbody>
  </Table>
{/snippet}

<Story name="Unsorted">{@render sample()}</Story>
<Story name="Ascending">{@render sample('ascending')}</Story>
<Story name="Descending">{@render sample('descending')}</Story>
