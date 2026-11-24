<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import CallCard from './CallCard.svelte'
  import { attackCall, checkCall, questionCall } from './play-fixtures'

  const { Story } = defineMeta({
    title: 'Play/CallCard',
    component: CallCard,
    tags: ['autodocs'],
    args: { call: checkCall, onroll: () => {}, onanswer: () => {} }
  })
</script>

<Story name="Check for two Characters" />
<Story name="Question with choices" args={{ call: questionCall }} />
<Story name="Free-text question" args={{ call: { ...questionCall, choices: [] } }} />
<Story name="Attack, damage next" args={{ call: attackCall }} />
