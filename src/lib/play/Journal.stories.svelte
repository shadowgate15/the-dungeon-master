<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import Journal from './Journal.svelte'
  import { journalEntries } from './play-fixtures'

  const { Story } = defineMeta({
    title: 'Play/Journal',
    component: Journal,
    tags: ['autodocs'],
    args: { entries: journalEntries }
  })
</script>

<Story name="The Party's Journal" />
<Story name="One Character" args={{ holders: false }} />
<Story name="Nothing yet" args={{ entries: [] }} />
