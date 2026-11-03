<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import SectionNav from './SectionNav.svelte'

  const { Story } = defineMeta({
    title: 'App/SectionNav',
    component: SectionNav,
    tags: ['autodocs']
  })
</script>

<Story name="Worlds current" args={{ current: 'worlds' }} />
<Story name="Campaigns current" args={{ current: 'campaigns' }} />
