<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import SessionHistory from './SessionHistory.svelte'
  import { sessionSummaries } from './play-fixtures'

  const { Story } = defineMeta({
    title: 'Play/SessionHistory',
    component: SessionHistory,
    tags: ['autodocs'],
    args: { sessions: sessionSummaries }
  })
</script>

<Story name="Two Sessions" />
<Story name="None yet" args={{ sessions: [] }} />
