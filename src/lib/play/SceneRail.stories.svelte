<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import SceneRail from './SceneRail.svelte'

  const { Story } = defineMeta({
    title: 'Play/SceneRail',
    component: SceneRail,
    tags: ['autodocs'],
    args: {
      scene: {
        clock: { minute: 3260, day: 3, time: '14:20' },
        place: { name: 'Drowned Lantern' },
        present: [
          { id: 'c-wren', name: 'Wren' },
          { id: 'c-bram', name: 'Bram' }
        ],
        elsewhere: []
      }
    }
  })
</script>

<Story name="In a Scene" />
<Story
  name="Before play begins"
  args={{
    scene: { clock: { minute: 0, day: 1, time: '08:00' }, place: null, present: [], elsewhere: [] }
  }}
/>
