<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import PermissionCard from './PermissionCard.svelte'

  const { Story } = defineMeta({
    title: 'Play/PermissionCard',
    component: PermissionCard,
    tags: ['autodocs'],
    args: {
      request: {
        requestId: 'abcde',
        toolName: 'Bash',
        description: 'List the Campaign folder',
        inputPreview: 'ls -la'
      },
      onanswer: () => {}
    }
  })
</script>

<Story name="Waiting on the Player" />
<Story
  name="No summary"
  args={{ request: { requestId: 'fghij', toolName: 'Write', description: '', inputPreview: '' } }}
/>
