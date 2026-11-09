<script lang="ts">
  import type { Spell } from '#lib/rules/schema.ts'
  import { parseSpellLine, spellLevelLabel } from './spell-text.ts'

  /**
   * The shared spell-details view: every field of an SRD spell, read-only. It is the panel only;
   * use `SpellDisclosure` for the "Details" button that expands it beside a spell name.
   */
  let { spell, id }: { spell: Spell; id?: string } = $props()

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  const level = $derived(capitalize(spellLevelLabel(spell.level)))
  const components = $derived(
    spell.components.join(', ') + (spell.material ? ` (${spell.material})` : '')
  )
  const duration = $derived(spell.duration + (spell.concentration ? ' (concentration)' : ''))
  const description = $derived(spell.description.map(parseSpellLine))
  const higher = $derived(spell.higherLevel.map(parseSpellLine))
</script>

{#snippet paragraphs(lines: ReturnType<typeof parseSpellLine>[])}
  {#each lines as line, i (i)}
    <p>
      {#if line.heading}<strong><em>{line.heading}</em></strong>&nbsp;{/if}{line.text}
    </p>
  {/each}
{/snippet}

<div
  {id}
  class="space-y-2 rounded-panel border border-border bg-raised p-3 text-sm"
  data-testid="spell-details"
>
  <p class="font-medium">
    {capitalize(spell.school)} · {level}
    {#if spell.ritual}
      <span class="ml-1 rounded-control border border-border px-1.5 text-xs">Ritual</span>
    {/if}
  </p>
  <dl class="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5">
    <dt class="text-muted">Casting time</dt>
    <dd>{spell.castingTime}</dd>
    <dt class="text-muted">Range</dt>
    <dd>{spell.range}</dd>
    <dt class="text-muted">Components</dt>
    <dd>{components}</dd>
    <dt class="text-muted">Duration</dt>
    <dd>{duration}</dd>
  </dl>
  <div class="space-y-2">{@render paragraphs(description)}</div>
  {#if higher.length}
    <div class="space-y-1">
      <p class="font-medium">At higher levels</p>
      {@render paragraphs(higher)}
    </div>
  {/if}
</div>
