<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import FloorComposer from './FloorComposer.svelte'
  import { declarations } from './play-fixtures'

  const { Story } = defineMeta({
    title: 'Play/FloorComposer',
    component: FloorComposer,
    tags: ['autodocs'],
    args: {
      acting: 'Wren',
      declarations,
      onsend: () => {},
      ondone: () => {},
      onedit: () => {},
      onwithdraw: () => {}
    }
  })
</script>

<Story name="With a pending tray" />
<Story name="Empty Floor" args={{ declarations: [] }} />
<Story name="DM answering" args={{ awaiting: true }} />
<Story name="No Character can act" args={{ acting: null, declarations: [] }} />
<Story
  name="Split Party"
  args={{ elsewhere: [{ id: 'c-mira', name: 'Mira', whereabouts: 'The Docks' }], oncut: () => {} }}
/>
<Story name="Locked to a Combat turn" args={{ declarations: [], turn: 'Wren' }} />
<Story name="A foe's Combat turn" args={{ acting: null, declarations: [], turn: 'Goblin 1' }} />
