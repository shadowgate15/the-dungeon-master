<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import SegmentedNav from './SegmentedNav.svelte'

  const { Story } = defineMeta({
    title: 'UI/SegmentedNav',
    component: SegmentedNav,
    tags: ['autodocs'],
    args: { label: 'World view' }
  })
</script>

<Story
  name="First current"
  args={{
    items: [
      { href: '/', label: 'Active (3)', current: true },
      { href: '/?view=archived', label: 'Archived (1)', current: false }
    ]
  }}
/>
<Story
  name="Second current"
  args={{
    items: [
      { href: '/', label: 'Active (3)', current: false },
      { href: '/?view=archived', label: 'Archived (1)', current: true }
    ]
  }}
/>
