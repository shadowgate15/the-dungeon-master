<script module lang="ts">
  import type { ComponentProps } from 'svelte'
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import Link from './Link.svelte'

  const { Story } = defineMeta({
    title: 'UI/Link',
    component: Link,
    tags: ['autodocs']
  })
</script>

{#snippet template(args: ComponentProps<typeof Link>)}
  <p class="text-sm">Return to <Link {...args}>the worlds list</Link>.</p>
{/snippet}

<Story name="Default" args={{ href: '/worlds' }} {template} />
<Story
  name="External"
  args={{ href: 'https://example.com', target: '_blank', rel: 'noreferrer' }}
  {template}
/>
