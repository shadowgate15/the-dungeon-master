<script lang="ts">
  import { ABILITY_KEYS } from '#lib/rules/derive-stats.ts'
  import type { SummaryModel } from '#lib/character/summary.ts'
  import StatsStrip from '#lib/character/StatsStrip.svelte'

  /**
   * The play screen's compact Character sheet. A pure view of a `SummaryModel`, so every number
   * comes from `deriveStats`; nothing is computed or stored here.
   */
  let { model }: { model: SummaryModel } = $props()

  const { data, names, stats } = $derived(model)
  const headline = $derived(
    [names.subrace ?? names.race, names.class].filter(Boolean).join(' ') +
      (names.background ? ` · ${names.background}` : '')
  )
  const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`)
  const saves = $derived(
    ABILITY_KEYS.map((key) => ({ key, save: stats.savingThrows[key] })).filter(
      ({ save }) => save.status === 'ok' && save.value.proficient
    )
  )
</script>

<section aria-label="Character sheet" class="space-y-3">
  <header>
    <h2 class="font-display text-lg">{data.name}</h2>
    <p class="text-xs text-muted">Level {data.level} {headline}</p>
  </header>
  <StatsStrip {stats} />
  {#if saves.length > 0}
    <p class="text-xs text-muted">
      Proficient saves:
      {saves
        .map(({ key, save }) =>
          save.status === 'ok' ? `${key.toUpperCase()} ${signed(save.value.modifier)}` : ''
        )
        .join(', ')}
    </p>
  {/if}
</section>
