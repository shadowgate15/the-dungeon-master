<script lang="ts">
  import type { ResolvedGroup } from '#lib/rules/resolver.ts'
  import Alert from '#lib/ui/Alert.svelte'
  import Button from '#lib/ui/Button.svelte'
  import Checkbox from '#lib/ui/Checkbox.svelte'
  import { spellPickFlags, spellsView } from './spells.ts'
  import { groupIssues, groupLabel } from './steps.ts'
  import type { CharacterWizard } from './wizard.svelte.ts'

  let { wizard }: { wizard: CharacterWizard } = $props()

  const ctx = $derived({
    rules: wizard.rules,
    draft: wizard.draft,
    resolved: wizard.resolved,
    stats: wizard.stats
  })
  const view = $derived(spellsView(ctx))
  const flags = $derived(spellPickFlags(ctx))
  const className = $derived(wizard.rules.classes.find((c) => c.slug === wizard.draft.class)?.name)
  const levels = $derived([
    { id: 'cantrips', title: 'Cantrips', ...view.cantrips },
    { id: 'spells', title: 'Level 1 spells', ...view.spells }
  ])
  const nameOf = (slug: string) => wizard.rules.spells.find((s) => s.slug === slug)?.name ?? slug

  /** Spells that cannot be ticked again: granted, or the racial cantrip. */
  const taken = $derived(
    new Set([...view.granted.map((g) => g.spell), ...view.groups.flatMap((g) => g.picks)])
  )

  function toggle(slug: string) {
    const has = wizard.draft.classSpells.includes(slug)
    wizard.update({
      classSpells: has
        ? wizard.draft.classSpells.filter((s) => s !== slug)
        : [...wizard.draft.classSpells, slug]
    })
  }

  function remove(slug: string) {
    wizard.update({ classSpells: wizard.draft.classSpells.filter((s) => s !== slug) })
  }

  /** One-pick racial group (the High Elf cantrip): ticking swaps the pick. */
  function toggleGroup(g: ResolvedGroup, slug: string) {
    const next = { ...wizard.draft.picks }
    if (g.picks.includes(slug)) delete next[g.key]
    else next[g.key] = [slug]
    wizard.update({ picks: next })
  }
</script>

<div class="space-y-6">
  {#if view.cantrips.max + view.spells.max === 0 && view.groups.length === 0}
    <p class="text-muted">Nothing to pick here.</p>
  {/if}

  {#if view.granted.length}
    <section class="space-y-1" aria-label="Granted spells" data-testid="granted-spells">
      <h3 class="font-display text-lg">Granted spells</h3>
      <p class="text-sm text-muted">
        These come with your race or subclass. They do not count against your picks.
      </p>
      <ul class="list-disc pl-6">
        {#each view.granted as g (g.spell)}
          <li>
            {g.name}
            <span class="text-sm text-muted">({g.level === 0 ? 'cantrip' : 'level 1'})</span>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#each view.groups as g (g.key)}
    <fieldset class="space-y-2 rounded-panel border border-border p-3" data-choice-key={g.key}>
      <legend class="px-1 font-medium">
        {groupLabel(g)}
        <span class="text-sm text-muted">({new Set(g.picks).size} of {g.choose})</span>
      </legend>
      <div class="grid gap-x-4 gap-y-1 sm:grid-cols-2">
        {#each g.options as o (o.slug)}
          {@const mine = g.picks.includes(o.slug)}
          {@const dup = !mine && wizard.draft.classSpells.includes(o.slug)}
          <label class={['flex items-center gap-2', dup && 'text-muted']}>
            <Checkbox checked={mine} disabled={dup} onchange={() => toggleGroup(g, o.slug)} />
            <span>{o.name}{dup ? ' (picked as a class cantrip)' : ''}</span>
          </label>
        {/each}
      </div>
      {#each groupIssues(g) as issue (issue)}
        <p class="text-sm text-muted">{issue}</p>
      {/each}
    </fieldset>
  {/each}

  {#if flags.length}
    <Alert variant="warning">
      <p class="mb-1 font-medium">These picks need attention</p>
      <ul class="space-y-1" data-testid="spell-flags">
        {#each flags as f, i (f.slug + i)}
          <li class="flex items-center justify-between gap-2">
            <span>{f.reason}</span>
            <Button size="sm" variant="ghost" onclick={() => remove(f.slug)}>
              Remove {nameOf(f.slug)}
            </Button>
          </li>
        {/each}
      </ul>
    </Alert>
  {/if}

  {#if view.cantrips.max + view.spells.max > 0}
    <p class="text-muted">
      {className} picks {view.cantrips.max} cantrip{view.cantrips.max === 1 ? '' : 's'}{view.spells
        .max
        ? ` and ${view.spells.max} level 1 spells${className === 'Wizard' ? ' for the spellbook' : ''}`
        : ''}.
    </p>
  {/if}

  {#if view.prepares !== null}
    <p data-testid="prepares-hint">
      You prepare <strong>{view.prepares}</strong>
      spell{view.prepares === 1 ? '' : 's'} each day
      {#if className === 'Wizard'}from your spellbook{:else}from the {className} list{/if}. This is
      worked out for you; you do not choose them now.
    </p>
  {:else if view.preparesPending}
    <p data-testid="prepares-hint" class="text-muted">
      You prepare spells each day (your casting modifier + level, at least 1). Set your ability
      scores to see the number.
    </p>
  {/if}

  {#each levels as level (level.id)}
    {#if level.max > 0}
      <fieldset
        class="space-y-2 rounded-panel border border-border p-3"
        data-testid={`spell-picks-${level.id}`}
      >
        <legend class="px-1 font-medium">
          {level.title}
          <span class="text-sm text-muted">({level.picked.length} of {level.max})</span>
        </legend>
        <div class="grid gap-x-4 gap-y-1 sm:grid-cols-2">
          {#each level.options as o (o.slug)}
            {@const on = level.picked.includes(o.slug)}
            {@const why = on
              ? null
              : taken.has(o.slug)
                ? 'already granted or chosen'
                : level.picked.length >= level.max
                  ? 'limit reached'
                  : null}
            <label class={['flex items-center gap-2', why && 'text-muted']}>
              <Checkbox checked={on} disabled={!!why} onchange={() => toggle(o.slug)} />
              <span>{o.name}{why ? ` (${why})` : ''}</span>
            </label>
          {/each}
        </div>
      </fieldset>
    {/if}
  {/each}
</div>
