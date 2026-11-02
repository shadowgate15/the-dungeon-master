<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import Table from './Table.svelte'
  import SortHeader from './SortHeader.svelte'

  const { Story } = defineMeta({
    title: 'UI/Table',
    component: Table,
    tags: ['autodocs']
  })
</script>

{#snippet header(sort?: 'ascending' | 'descending')}
  <thead class="border-b border-border">
    <tr>
      <SortHeader {sort}>Name</SortHeader>
      <SortHeader>Campaigns</SortHeader>
      <th class="p-2 font-medium">Genre</th>
    </tr>
  </thead>
{/snippet}

<Story name="Unsorted">
  <Table>
    {@render header()}
    <tbody>
      <tr><td class="p-2">Eldermoor</td><td class="p-2">2</td><td class="p-2">High fantasy</td></tr>
      <tr><td class="p-2">Gloamfen</td><td class="p-2">0</td><td class="p-2">Dark fantasy</td></tr>
    </tbody>
  </Table>
</Story>

<Story name="Sorted ascending">
  <Table>
    {@render header('ascending')}
    <tbody>
      <tr><td class="p-2">Eldermoor</td><td class="p-2">2</td><td class="p-2">High fantasy</td></tr>
      <tr><td class="p-2">Gloamfen</td><td class="p-2">0</td><td class="p-2">Dark fantasy</td></tr>
    </tbody>
  </Table>
</Story>

<Story name="Sorted descending">
  <Table>
    {@render header('descending')}
    <tbody>
      <tr><td class="p-2">Gloamfen</td><td class="p-2">0</td><td class="p-2">Dark fantasy</td></tr>
      <tr><td class="p-2">Eldermoor</td><td class="p-2">2</td><td class="p-2">High fantasy</td></tr>
    </tbody>
  </Table>
</Story>

<Story name="Empty">
  <Table>
    {@render header()}
    <tbody></tbody>
    {#snippet empty()}No worlds yet.{/snippet}
  </Table>
</Story>
