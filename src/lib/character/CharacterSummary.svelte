<script lang="ts">
  import { ABILITY_KEYS, type Stat } from '#lib/rules/derive-stats.ts'
  import type { SummaryModel } from './summary.ts'

  /**
   * The read-only Character summary, shared by the Review step and /characters/[id]. A pure view
   * of a `SummaryModel`: every number comes from `deriveStats`, nothing is computed here. AC is
   * unarmored only (armor and shield AC wait for the later sheet effort), and labelled so.
   */
  let { model }: { model: SummaryModel } = $props()

  const { data, names, stats, resolved } = $derived(model)

  const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`)
  const show = <T,>(s: Stat<T>, format: (v: T) => string) =>
    s.status === 'ok' ? format(s.value) : '—'
  const why = (s: Stat<unknown>) =>
    s.status === 'pending' ? `Needs ${s.missing.join(', ')}` : undefined
  const title = (slug: string) => slug.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase())

  const headline = $derived(
    [names.subrace ?? names.race, names.class].filter(Boolean).join(' ') +
      (names.background ? ` · ${names.background}` : '')
  )
  const narrative = $derived(
    (
      [
        ['Appearance', data.appearance],
        ['Personality', data.personality],
        ['Ideal', data.ideal],
        ['Bond', data.bond],
        ['Flaw', data.flaw],
        ['Backstory', data.backstory]
      ] as const
    ).filter(([, text]) => text.trim())
  )
  const skills = $derived(Object.entries(stats.skills))
  const proficiencyGroups = $derived(
    Object.entries(
      Object.groupBy(
        resolved.proficiencies.filter((p) => p.type !== 'Skills' && p.type !== 'Saving Throws'),
        (p) => p.type
      )
    )
  )
  const tiles = $derived([
    { label: 'Hit points', stat: stats.hitPoints, text: show(stats.hitPoints, String) },
    {
      label: 'Armor class (unarmored)',
      stat: stats.unarmoredAc,
      text: show(stats.unarmoredAc, (a) => `${a.value}`),
      note: stats.unarmoredAc.status === 'ok' ? stats.unarmoredAc.value.formula : undefined
    },
    { label: 'Speed', stat: stats.speed, text: show(stats.speed, (v) => `${v} ft`) },
    {
      label: 'Initiative',
      stat: stats.initiative,
      text: show(stats.initiative, signed)
    },
    {
      label: 'Proficiency bonus',
      stat: stats.proficiencyBonus,
      text: show(stats.proficiencyBonus, signed)
    },
    {
      label: 'Passive Perception',
      stat: stats.passivePerception,
      text: show(stats.passivePerception, String)
    }
  ])
  const casting = $derived(stats.spellcasting.status === 'ok' ? stats.spellcasting.value : null)
  const slots = $derived(
    stats.spellSlots.status === 'ok'
      ? stats.spellSlots.value.map((n, i) => ({ level: i + 1, n })).filter((s) => s.n > 0)
      : []
  )
  const attacks = $derived(stats.attacks.status === 'ok' ? stats.attacks.value : [])
</script>

<article aria-label="Character summary" class="space-y-6">
  <header>
    <h2 class="font-display text-2xl">{data.name || 'Unnamed Character'}</h2>
    <p class="text-muted">
      Level {data.level}
      {headline}{names.subclass ? ` (${names.subclass})` : ''}{names.alignment
        ? ` · ${names.alignment}`
        : ''}
    </p>
  </header>

  <section aria-label="Ability scores" class="grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
    {#each ABILITY_KEYS as key (key)}
      {@const a = stats.abilities[key]}
      <div
        role="group"
        aria-label={key.toUpperCase()}
        title={why(a)}
        class="rounded-control border border-border bg-raised p-2"
      >
        <div class="text-xs text-muted uppercase">{key}</div>
        <div class="text-xl font-semibold">{show(a, (v) => String(v.score))}</div>
        <div>{show(a, (v) => signed(v.modifier))}</div>
        {#if a.status === 'ok' && a.value.racialBonus !== 0}
          <div class="text-xs text-muted">
            {a.value.base}
            {signed(a.value.racialBonus)} racial
          </div>
        {/if}
      </div>
    {/each}
  </section>

  <section aria-label="Combat" class="grid grid-cols-2 gap-2 sm:grid-cols-3">
    {#each tiles as tile (tile.label)}
      <div
        role="group"
        aria-label={tile.label}
        title={why(tile.stat)}
        class="rounded-control border border-border bg-raised p-2"
      >
        <div class="text-xs text-muted">{tile.label}</div>
        <div class="text-lg font-semibold">{tile.text}</div>
        {#if tile.note}<div class="text-xs text-muted">{tile.note}</div>{/if}
      </div>
    {/each}
  </section>

  <div class="grid gap-6 md:grid-cols-2">
    <section aria-label="Saving throws" class="space-y-1">
      <h3 class="font-display text-lg">Saving throws</h3>
      <ul class="text-sm">
        {#each ABILITY_KEYS as key (key)}
          {@const s = stats.savingThrows[key]}
          <li>
            <span aria-hidden="true">{s.status === 'ok' && s.value.proficient ? '●' : '○'}</span>
            {show(s, (v) => signed(v.modifier))}
            {key.toUpperCase()}{s.status === 'ok' && s.value.proficient ? ' (proficient)' : ''}
          </li>
        {/each}
      </ul>
    </section>

    <section aria-label="Skills" class="space-y-1">
      <h3 class="font-display text-lg">Skills</h3>
      <ul class="text-sm">
        {#each skills as [slug, s] (slug)}
          <li>
            <span aria-hidden="true">
              {s.status === 'ok' && s.value.expertise
                ? '◆'
                : s.status === 'ok' && s.value.proficient
                  ? '●'
                  : '○'}
            </span>
            {show(s, (v) => signed(v.modifier))}
            {title(slug)}
            {#if s.status === 'ok'}
              <span class="text-muted">
                ({s.value.ability.toUpperCase()}{s.value.expertise
                  ? ', expertise'
                  : s.value.proficient
                    ? ', proficient'
                    : ''})
              </span>
            {/if}
          </li>
        {/each}
      </ul>
    </section>
  </div>

  {#if casting}
    <section aria-label="Spellcasting" class="space-y-1">
      <h3 class="font-display text-lg">Spellcasting</h3>
      <p class="text-sm">
        Ability {casting.ability.toUpperCase()} · Save DC {casting.saveDc} · Spell attack {signed(
          casting.attackBonus
        )}{casting.preparedCount !== null ? ` · Prepares ${casting.preparedCount}` : ''}
      </p>
      {#if slots.length > 0}
        <p class="text-sm text-muted">
          Slots: {slots.map((s) => `level ${s.level} × ${s.n}`).join(', ')}
        </p>
      {/if}
    </section>
  {/if}

  {#if model.spells.length > 0}
    <section aria-label="Spells" class="space-y-1">
      <h3 class="font-display text-lg">Spells</h3>
      <ul class="text-sm">
        {#each model.spells as s (s.name)}
          <li>
            {s.name}
            <span class="text-muted">({s.level === 0 ? 'cantrip' : `level ${s.level}`})</span>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if attacks.length > 0}
    <section aria-label="Attacks" class="space-y-1">
      <h3 class="font-display text-lg">Attacks</h3>
      <ul class="text-sm">
        {#each attacks as a (a.weapon)}
          <li>
            {a.name}: {signed(a.attackBonus)} to hit{a.damage
              ? `, ${a.damage.dice}${a.damage.modifier ? signed(a.damage.modifier) : ''} ${a.damage.type}`
              : ''}
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  <section aria-label="Proficiencies and languages" class="space-y-1">
    <h3 class="font-display text-lg">Proficiencies and languages</h3>
    <dl class="space-y-1 text-sm">
      {#each proficiencyGroups as [type, list] (type)}
        <div>
          <dt class="inline font-medium">{type}:</dt>
          <dd class="inline">{list?.map((p) => p.name).join(', ')}</dd>
        </div>
      {/each}
      {#if resolved.languages.length > 0}
        <div>
          <dt class="inline font-medium">Languages:</dt>
          <dd class="inline">{resolved.languages.map((l) => l.name).join(', ')}</dd>
        </div>
      {/if}
    </dl>
  </section>

  {#if resolved.features.length > 0 || data.customBackgroundFeature}
    <section aria-label="Features" class="space-y-1">
      <h3 class="font-display text-lg">Features and traits</h3>
      <ul class="list-disc pl-5 text-sm">
        {#each resolved.features as f (f.source + f.slug)}<li>{f.name}</li>{/each}
        {#if data.customBackgroundFeature}<li>{data.customBackgroundFeature}</li>{/if}
      </ul>
    </section>
  {/if}

  {#if model.equipment.length > 0}
    <section aria-label="Equipment" class="space-y-1">
      <h3 class="font-display text-lg">Equipment</h3>
      <ul class="list-disc pl-5 text-sm">
        {#each model.equipment as e, i (i)}
          <li>{e.name}{e.quantity > 1 ? ` × ${e.quantity}` : ''}</li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if narrative.length > 0}
    <section aria-label="Details" class="space-y-2">
      {#each narrative as [label, text] (label)}
        <div>
          <h3 class="font-display text-lg">{label}</h3>
          <p class="text-sm whitespace-pre-wrap">{text}</p>
        </div>
      {/each}
    </section>
  {/if}
</article>
