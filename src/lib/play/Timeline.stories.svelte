<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import Timeline from './Timeline.svelte'
  import { attackRollEntries, rollEntries, timelineEntries } from './play-fixtures'

  const { Story } = defineMeta({
    title: 'Play/Timeline',
    component: Timeline,
    tags: ['autodocs'],
    args: { entries: timelineEntries, awaitingSince: null }
  })
</script>

<Story name="A play turn" />
<Story name="DM working" args={{ awaitingSince: Date.now() - 7_000 }} />
<Story name="Nothing yet" args={{ entries: [] }} />
<Story name="Rolls and answers" args={{ entries: [...timelineEntries, ...rollEntries] }} />
<Story name="Attack rolls" args={{ entries: attackRollEntries }} />
