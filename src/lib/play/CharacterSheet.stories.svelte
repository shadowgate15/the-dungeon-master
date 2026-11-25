<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import CharacterSheet from './CharacterSheet.svelte'
  import { levelUpOffer, sheets } from './play-fixtures'

  const { Story } = defineMeta({
    title: 'Play/CharacterSheet',
    component: CharacterSheet,
    tags: ['autodocs'],
    args: { sheets, acting: 'wren', onselect: () => {} }
  })
</script>

<Story name="Wounded caster" />
<Story name="Character elsewhere" args={{ acting: 'bram' }} />
<Story name="Empty Party" args={{ sheets: [], acting: null }} />
<Story
  name="Level awarded"
  args={{
    sheets: sheets.map((s) => (s.id === 'wren' ? { ...s, levelUp: levelUpOffer } : s)),
    onlevelup: () => {}
  }}
/>
<Story name="Downed, rolling Death saves" args={{ acting: 'osric' }} />
