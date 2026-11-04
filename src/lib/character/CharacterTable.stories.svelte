<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import CharacterTable, { type CharacterListItem } from './CharacterTable.svelte'

  const brannoch: CharacterListItem = {
    id: 'ch1',
    name: 'Brannoch',
    raceName: 'Dwarf',
    subraceName: 'Hill Dwarf',
    className: 'Cleric',
    backgroundName: 'Acolyte',
    level: 1,
    updatedAt: Date.UTC(2026, 10, 2)
  }
  const ilyra: CharacterListItem = {
    ...brannoch,
    id: 'ch2',
    name: 'Ilyra',
    raceName: 'Human',
    subraceName: null,
    className: 'Wizard'
  }

  const { Story } = defineMeta({
    title: 'Character/CharacterTable',
    component: CharacterTable,
    tags: ['autodocs'],
    args: { characters: [brannoch, ilyra], view: 'active', activeCount: 2, archivedCount: 1 }
  })
</script>

<Story name="Active" />
<Story name="Empty" args={{ characters: [], activeCount: 0 }} />
