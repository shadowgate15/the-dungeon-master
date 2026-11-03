<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import WorldPicker from './WorldPicker.svelte'

  const worlds = [
    { id: 'w1', name: 'Ashfall' },
    { id: 'w2', name: 'Bramble' },
    { id: 'w3', name: 'Cinder' }
  ]

  const { Story } = defineMeta({
    title: 'Campaign/WorldPicker',
    component: WorldPicker,
    tags: ['autodocs'],
    args: { worlds }
  })
</script>

<Story name="One World" args={{ value: ['w1'] }} />
<Story name="Several Worlds" args={{ value: ['w1', 'w2'] }} />
<Story name="None chosen" args={{ value: [] }} />
