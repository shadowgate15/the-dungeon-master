<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import spells from '#lib/rules/data/spells.json'
  import type { Spell } from '#lib/rules/schema.ts'
  import SpellDetails from './SpellDetails.svelte'
  import SpellDisclosure from './SpellDisclosure.svelte'

  const bySlug = (slug: string) => spells.find((s) => s.slug === slug) as unknown as Spell

  const { Story } = defineMeta({
    title: 'Character/SpellDetails',
    component: SpellDetails,
    tags: ['autodocs']
  })
</script>

<Story name="Cantrip" args={{ spell: bySlug('fire-bolt') }} />
<Story name="Level 1 with higher levels" args={{ spell: bySlug('sleep') }} />
<Story name="Ritual and concentration" args={{ spell: bySlug('detect-magic') }} />
<Story name="Run-in headings (Command)" args={{ spell: bySlug('command') }} />

<Story name="Disclosure, collapsed" asChild>
  <div class="max-w-md">
    <SpellDisclosure spell={bySlug('command')}>
      {#snippet row()}<span>Command</span>{/snippet}
    </SpellDisclosure>
  </div>
</Story>
