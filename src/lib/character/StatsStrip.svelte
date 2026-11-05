<script lang="ts">
  import { ABILITY_KEYS, type DerivedStats, type Stat } from '#lib/rules/derive-stats.ts'

  /** Pure view of `deriveStats`: a pending stat shows a dash and says what it waits for. */
  let { stats }: { stats: DerivedStats } = $props()

  const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`)
  const why = (s: Stat<unknown>) =>
    s.status === 'pending' ? `Needs ${s.missing.join(', ')}` : undefined
  const show = <T,>(s: Stat<T>, format: (v: T) => string) =>
    s.status === 'ok' ? format(s.value) : '—'

  const tiles = $derived([
    { label: 'HP', hint: why(stats.hitPoints), text: show(stats.hitPoints, String) },
    {
      label: 'AC (unarmored)',
      hint: why(stats.unarmoredAc),
      text: show(stats.unarmoredAc, (a) => String(a.value))
    },
    { label: 'Speed', hint: why(stats.speed), text: show(stats.speed, String) }
  ])
</script>

<div role="group" aria-label="Computed stats" class="grid grid-cols-6 gap-2 text-center text-xs">
  {#each ABILITY_KEYS as key (key)}
    {@const a = stats.abilities[key]}
    <div
      role="group"
      aria-label={key.toUpperCase()}
      title={why(a)}
      class="rounded-control border border-border bg-raised p-1.5"
    >
      <div class="text-muted uppercase">{key}</div>
      <div class="text-base font-semibold">{show(a, (v) => String(v.score))}</div>
      <div>
        {show(a, (v) => signed(v.modifier)) === '—' ? '' : show(a, (v) => signed(v.modifier))}
      </div>
    </div>
  {/each}
  {#each tiles as tile (tile.label)}
    <div
      role="group"
      aria-label={tile.label}
      title={tile.hint}
      class="col-span-2 rounded-control border border-border bg-raised p-1.5"
    >
      <span class="text-muted">{tile.label}</span>
      <strong>{tile.text}</strong>
    </div>
  {/each}
</div>
