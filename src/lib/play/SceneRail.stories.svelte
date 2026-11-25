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
<Story
  name="In a Combat"
  args={{
    scene: {
      clock: { minute: 0, day: 1, time: '08:00' },
      place: { name: 'Ruined Chapel' },
      present: [
        { id: 'c-wren', name: 'Wren' },
        { id: 'c-ash', name: 'Ash' }
      ],
      elsewhere: [],
      combat: {
        round: 2,
        waiting: [],
        order: [
          {
            key: 'a',
            name: 'Wren',
            kind: 'character',
            characterId: 'c-wren',
            initiative: 20,
            current: false,
            state: null
          },
          {
            key: 'b',
            name: 'Goblin 2',
            kind: 'creature',
            characterId: null,
            initiative: 17,
            current: true,
            state: 'bloodied'
          },
          {
            key: 'c',
            name: 'Goblin 1',
            kind: 'creature',
            characterId: null,
            initiative: 12,
            current: false,
            state: 'down'
          },
          {
            key: 'd',
            name: 'Ash',
            kind: 'character',
            characterId: 'c-ash',
            initiative: 7,
            current: false,
            state: null
          }
        ]
      }
    }
  }}
/>
<Story
  name="Rolling initiative"
  args={{
    scene: {
      clock: { minute: 0, day: 1, time: '08:00' },
      place: { name: 'Ruined Chapel' },
      present: [],
      elsewhere: [],
      combat: { round: 0, waiting: ['Wren', 'Ash'], order: [] }
    }
  }}
/>
