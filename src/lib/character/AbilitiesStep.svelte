<script lang="ts">
  import { cappedScore, MAX_ABILITY_SCORE, type AbilityKey } from '#lib/rules/derive-stats.ts'
  import Button from '#lib/ui/Button.svelte'
  import Checkbox from '#lib/ui/Checkbox.svelte'
  import Select from '#lib/ui/Select.svelte'
  import {
    ABILITY_KEYS,
    ABILITY_LABELS,
    POINT_BUY,
    STANDARD_ARRAY,
    availableValues,
    methodPatch,
    pointCost,
    pointsSpent,
    rollAbilityScores,
    rollTotal,
    rollTotals,
    type DraftAbilityMethod
  } from './ability-scores.ts'
  import type { CharacterWizard } from './wizard.svelte.ts'

  let { wizard }: { wizard: CharacterWizard } = $props()

  const draft = $derived(wizard.draft)
  const method = $derived(draft.abilityMethod)
  const bonusGroups = $derived(wizard.resolved.groups.filter((g) => g.kind === 'abilityBonus'))
  const spent = $derived(pointsSpent(draft.baseScores))
  const remaining = $derived(POINT_BUY.budget - spent)
  const pool = $derived(
    method === 'standard-array'
      ? [...STANDARD_ARRAY]
      : method === 'rolling' && draft.abilityRolls
        ? rollTotals(draft.abilityRolls)
        : []
  )

  const METHODS: { id: DraftAbilityMethod; label: string; hint: string }[] = [
    {
      id: 'standard-array',
      label: 'Standard array',
      hint: `Assign ${STANDARD_ARRAY.join(', ')}, one to each ability.`
    },
    {
      id: 'point-buy',
      label: 'Point buy',
      hint: `Spend up to ${POINT_BUY.budget} points; scores run ${POINT_BUY.min} to ${POINT_BUY.max} before racial bonuses.`
    },
    {
      id: 'rolling',
      label: 'Rolling',
      hint: 'Roll four dice six times and drop the lowest of each; assign the totals.'
    }
  ]

  const unassigned = { str: null, dex: null, con: null, int: null, wis: null, cha: null }

  function chooseMethod(next: DraftAbilityMethod) {
    if (next === method) return
    wizard.update(methodPatch(next))
  }

  function setScore(key: AbilityKey, value: number | null) {
    wizard.update({ baseScores: { ...draft.baseScores, [key]: value } })
  }

  function adjust(key: AbilityKey, delta: 1 | -1) {
    const current = draft.baseScores[key] ?? POINT_BUY.min
    const next = current + delta
    if (pointCost(next) === undefined) return
    if (delta > 0 && pointCost(next)! - pointCost(current)! > remaining) return
    setScore(key, next)
  }

  /** A reroll replaces the whole set, so earlier assignments no longer mean anything. */
  function roll() {
    wizard.update({ abilityRolls: rollAbilityScores(), baseScores: { ...unassigned } })
  }

  function togglePick(groupKey: string, slug: string, on: boolean, current: string[]) {
    const next = on ? [...current, slug] : current.filter((s) => s !== slug)
    wizard.update({ picks: { ...draft.picks, [groupKey]: next } })
  }

  const bonusOf = (key: AbilityKey) => wizard.resolved.abilityBonusTotals[key] ?? 0
  const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`)
</script>

<div class="space-y-5">
  <fieldset class="space-y-2">
    <legend class="text-sm font-medium text-text">Method</legend>
    <div class="grid gap-2 sm:grid-cols-3">
      {#each METHODS as m (m.id)}
        <label
          class={[
            'flex cursor-pointer flex-col gap-1 rounded-control border p-3',
            method === m.id ? 'border-primary bg-surface' : 'border-control-border bg-raised'
          ]}
        >
          <span class="flex items-center gap-2 font-medium text-text">
            <input
              type="radio"
              name="ability-method"
              value={m.id}
              checked={method === m.id}
              onchange={() => chooseMethod(m.id)}
            />
            {m.label}
          </span>
          <span class="text-sm text-muted">{m.hint}</span>
        </label>
      {/each}
    </div>
  </fieldset>

  {#if method === 'point-buy'}
    <p class="text-sm font-medium text-text" aria-live="polite">
      Points remaining: <span data-testid="points-remaining">{remaining}</span> of {POINT_BUY.budget}
    </p>
  {/if}

  {#if method === 'rolling'}
    <section class="space-y-2" aria-label="Rolled dice">
      <div class="flex items-center gap-3">
        <Button variant="secondary" onclick={roll}>
          {draft.abilityRolls ? 'Reroll all' : 'Roll scores'}
        </Button>
        <span class="text-sm text-muted">
          Rerolling replaces the whole set. Switching method keeps it.
        </span>
      </div>
      {#if draft.abilityRolls}
        <ol class="grid gap-1 sm:grid-cols-2">
          {#each draft.abilityRolls as dice, i (i)}
            {@const lowest = dice.indexOf(Math.min(...dice))}
            <li class="text-sm text-text" aria-label={`Roll ${i + 1}`}>
              Roll {i + 1}:
              {#each dice as d, j (j)}
                <span
                  class={[
                    'mr-1 inline-block',
                    j === lowest ? 'text-muted line-through' : 'font-medium'
                  ]}
                  title={j === lowest ? 'Dropped' : undefined}>{d}</span
                >
              {/each}
              = <strong>{rollTotal(dice)}</strong>
            </li>
          {/each}
        </ol>
      {/if}
    </section>
  {/if}

  {#if method && !(method === 'rolling' && !draft.abilityRolls)}
    <table class="w-full text-left text-sm">
      <thead class="text-muted">
        <tr>
          <th scope="col" class="py-1 pr-2 font-medium">Ability</th>
          <th scope="col" class="py-1 pr-2 font-medium">Base</th>
          <th scope="col" class="py-1 pr-2 font-medium">Racial</th>
          <th scope="col" class="py-1 font-medium">Score</th>
        </tr>
      </thead>
      <tbody>
        {#each ABILITY_KEYS as key (key)}
          {@const base = draft.baseScores[key]}
          {@const bonus = bonusOf(key)}
          {@const total = base === null ? null : cappedScore(base, bonus)}
          <tr class="border-t border-control-border">
            <th scope="row" class="py-2 pr-2 font-medium text-text">{ABILITY_LABELS[key]}</th>
            <td class="py-2 pr-2">
              {#if method === 'point-buy'}
                <div class="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    aria-label={`Decrease ${ABILITY_LABELS[key]}`}
                    disabled={(base ?? POINT_BUY.min) <= POINT_BUY.min}
                    onclick={() => adjust(key, -1)}>−</Button
                  >
                  <span class="w-6 text-center" data-testid={`base-${key}`}>{base}</span>
                  <Button
                    size="sm"
                    variant="secondary"
                    aria-label={`Increase ${ABILITY_LABELS[key]}`}
                    disabled={(base ?? POINT_BUY.min) >= POINT_BUY.max ||
                      pointCost((base ?? POINT_BUY.min) + 1)! - pointCost(base ?? POINT_BUY.min)! >
                        remaining}
                    onclick={() => adjust(key, 1)}>+</Button
                  >
                  <span class="text-muted">{pointCost(base ?? POINT_BUY.min)} pts</span>
                </div>
              {:else}
                <Select
                  size="sm"
                  aria-label={`${ABILITY_LABELS[key]} base score`}
                  value={base === null ? '' : String(base)}
                  onchange={(e) => {
                    const v = e.currentTarget.value
                    setScore(key, v === '' ? null : Number(v))
                  }}
                >
                  <option value="">Choose…</option>
                  {#each availableValues(pool, draft.baseScores, key) as v, i (i)}
                    <option value={String(v)}>{v}</option>
                  {/each}
                </Select>
              {/if}
            </td>
            <td class="py-2 pr-2 text-muted" data-testid={`racial-${key}`}>
              {bonus ? signed(bonus) : '—'}
            </td>
            <td class="py-2 font-medium text-text" data-testid={`score-${key}`}>
              {total ?? '—'}
              {#if base !== null && base + bonus > MAX_ABILITY_SCORE}
                <span class="font-normal text-muted">(capped at {MAX_ABILITY_SCORE})</span>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}

  {#each bonusGroups as group (group.key)}
    {@const picks = draft.picks[group.key] ?? []}
    <fieldset class="space-y-2">
      <legend class="text-sm font-medium text-text">
        Racial bonus: choose {group.choose} abilities for +1 each
      </legend>
      <div class="flex flex-wrap gap-4">
        {#each group.options as option (option.slug)}
          {@const checked = picks.includes(option.slug)}
          <label class="flex items-center gap-2 text-sm text-text">
            <Checkbox
              {checked}
              disabled={option.disabled !== null || (!checked && picks.length >= group.choose)}
              onchange={(e) => togglePick(group.key, option.slug, e.currentTarget.checked, picks)}
            />
            {ABILITY_LABELS[option.slug as AbilityKey] ?? option.name}
          </label>
        {/each}
      </div>
    </fieldset>
  {/each}
</div>
