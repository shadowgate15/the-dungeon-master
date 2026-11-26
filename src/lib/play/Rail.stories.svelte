<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import type { ComponentProps } from 'svelte'
  import type { JournalEntry } from './journal'
  import { journalEntries } from './play-fixtures'
  import Rail from './Rail.svelte'
  import type { SceneView } from './scene'

  const clock = { minute: 0, day: 1, time: '08:00' }

  const longCombat: SceneView = {
    clock,
    place: { name: 'Ruined Chapel' },
    present: [{ id: 'wren', name: 'Wren' }],
    elsewhere: [],
    combat: {
      round: 3,
      waiting: [],
      order: Array.from({ length: 20 }, (_, i) => ({
        key: `g${i}`,
        name: `Goblin ${i + 1}`,
        kind: 'creature' as const,
        characterId: null,
        initiative: 22 - i,
        current: i === 14,
        state: i % 5 === 0 ? 'bloodied' : null
      }))
    }
  }

  const manyEntries: JournalEntry[] = Array.from({ length: 12 }, (_, i) => ({
    id: `m${i}`,
    about: { name: `Villager ${i + 1}`, type: 'npc' as const },
    text: `Villager ${i + 1} saw something on the moor road`,
    source: i % 2 ? 'a dockhand' : null,
    holders: [{ id: 'wren', name: 'Wren' }]
  }))

  const { Story } = defineMeta({
    title: 'Play/Rail',
    component: Rail,
    tags: ['autodocs'],
    args: { scene: longCombat, believer: 'Wren', entries: manyEntries, actor: 'wren' }
  })
</script>

<!-- The play console's column: 15rem wide, its height bound to the viewport. -->
{#snippet template(args: ComponentProps<typeof Rail>)}
  <div class="grid h-[32rem] w-60">
    <Rail {...args} />
  </div>
{/snippet}

<Story name="Overflowing cards scroll inside" {template} />
<Story
  name="Short content keeps its size"
  {template}
  args={{
    scene: {
      ...longCombat,
      combat: { ...longCombat.combat!, order: longCombat.combat!.order.slice(0, 3) }
    },
    entries: journalEntries,
    actor: undefined,
    believer: 'the Party'
  }}
/>
<Story name="Out of Combat" {template} args={{ scene: { ...longCombat, combat: undefined } }} />
