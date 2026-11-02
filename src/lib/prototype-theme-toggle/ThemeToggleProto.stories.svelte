<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import ThemeToggleProto from './ThemeToggleProto.svelte'

  const { Story } = defineMeta({
    title: 'PROTOTYPE/Theme toggle',
    component: ThemeToggleProto,
    parameters: { layout: 'fullscreen' }
  })
</script>

<Story name="A: Segmented in header" args={{ variant: 'A' }} />
<Story name="B: Cycle button in header" args={{ variant: 'B' }} />
<Story name="C: Menu in header" args={{ variant: 'C' }} />
<Story name="A dark" args={{ variant: 'A', initial: 'dark' }} />
<Story name="B dark" args={{ variant: 'B', initial: 'dark' }} />
<Story name="C dark" args={{ variant: 'C', initial: 'dark' }} />
