<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import StepRail from './StepRail.svelte'

  const { Story } = defineMeta({
    title: 'Character/StepRail',
    component: StepRail,
    tags: ['autodocs'],
    args: { current: 'concept', onselect: () => {}, onabandon: () => {} }
  })
</script>

<Story
  name="Fresh draft"
  args={{
    steps: [
      { id: 'concept', label: 'Concept', status: 'incomplete' },
      { id: 'abilities', label: 'Ability scores', status: 'locked' },
      { id: 'skills', label: 'Skills & features', status: 'locked' },
      { id: 'equipment', label: 'Equipment', status: 'locked' },
      { id: 'review', label: 'Review', status: 'locked' }
    ]
  }}
/>
<Story
  name="Mixed statuses"
  args={{
    current: 'abilities',
    steps: [
      { id: 'concept', label: 'Concept', status: 'valid' },
      { id: 'abilities', label: 'Ability scores', status: 'incomplete', suggestions: 2 },
      {
        id: 'skills',
        label: 'Skills & features',
        status: 'attention',
        issues: ['You can only have 2 skills.']
      },
      { id: 'equipment', label: 'Equipment', status: 'incomplete' },
      { id: 'spells', label: 'Spells', status: 'valid' },
      { id: 'review', label: 'Review', status: 'locked' }
    ]
  }}
/>
