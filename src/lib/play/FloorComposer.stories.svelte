<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import FloorComposer from './FloorComposer.svelte'
  import { declarations } from './play-fixtures'

  const { Story } = defineMeta({
    title: 'Play/FloorComposer',
    component: FloorComposer,
    tags: ['autodocs'],
    args: { acting: 'Wren', declarations, onsend: () => {}, onedit: () => {}, onwithdraw: () => {} }
  })
</script>

<Story name="With a pending tray" />
<Story name="Empty Floor" args={{ declarations: [] }} />
<Story name="No Character can act" args={{ acting: null, declarations: [] }} />
