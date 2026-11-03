<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import CampaignTable, { type CampaignListItem } from './CampaignTable.svelte'

  const ember: CampaignListItem = {
    id: 'c1',
    name: 'Ember Road',
    premise: 'Escort a relic across the ash plains.',
    tone: 'tense',
    length: 'short',
    updatedAt: Date.UTC(2026, 10, 2),
    worlds: [
      { id: 'w1', name: 'Ashfall', archived: false },
      { id: 'w2', name: 'Bramble', archived: true }
    ]
  }
  const calm: CampaignListItem = {
    ...ember,
    id: 'c2',
    name: 'Lantern Vale',
    premise: 'A quiet valley hides an old promise.',
    tone: 'lighthearted',
    length: 'long',
    worlds: [{ id: 'w1', name: 'Ashfall', archived: false }]
  }

  const { Story } = defineMeta({
    title: 'Campaign/CampaignTable',
    component: CampaignTable,
    tags: ['autodocs'],
    args: { campaigns: [ember, calm], view: 'active', activeCount: 2, archivedCount: 1 }
  })
</script>

<Story name="Active" />
<Story name="Filtered by World" args={{ worldFilter: { id: 'w1', name: 'Ashfall' } }} />
<Story name="Empty" args={{ campaigns: [], activeCount: 0 }} />
