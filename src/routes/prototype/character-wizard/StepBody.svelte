<!-- PROTOTYPE (throwaway): the form widgets for each step. Layout around it is per-variant. -->
<script lang="ts">
  import Button from '#lib/ui/Button.svelte'
  import Badge from '#lib/ui/Badge.svelte'
  import ProposalCards from './ProposalCards.svelte'
  import {
    ABILITIES,
    ALIGNMENTS,
    BACKGROUND_SKILLS,
    CANTRIPS,
    CLASSES,
    POINT_COST,
    RACES,
    SPELLS,
    STEP_LABELS,
    fmt,
    type Method,
    type Wizard
  } from './model.svelte.ts'

  let { w, inlineProposals = false }: { w: Wizard; inlineProposals?: boolean } = $props()
  const step = $derived(w.current)
  const input = 'w-full rounded-control border border-control-border bg-raised px-3 py-2 text-text'
  const flags = $derived(w.flags(step))
  const methods: [Method, string][] = [
    ['array', 'Standard array'],
    ['pointbuy', 'Point buy'],
    ['roll', 'Roll 4d6 (drop lowest)']
  ]
</script>

<div class="space-y-4">
  {#if inlineProposals}<ProposalCards {w} {step} />{/if}

  {#if flags.length}
    <div
      class="rounded-panel border border-warning bg-warning-bg p-3 text-sm text-text"
      role="status"
    >
      <strong>Needs attention</strong>
      <ul class="list-disc pl-5">
        {#each flags as f (f)}<li>{f}</li>{/each}
      </ul>
    </div>
  {/if}

  {#if step === 'concept'}
    <div class="grid gap-3 sm:grid-cols-2">
      <label class="block text-sm">Name<input class={input} bind:value={w.name} /></label>
      <label class="block text-sm"
        >Alignment
        <select class={input} bind:value={w.alignment}
          ><option value="">Unspecified</option>{#each ALIGNMENTS as a (a)}<option>{a}</option
            >{/each}</select
        ></label
      >
      <label class="block text-sm"
        >Race
        <select class={input} value={w.race} onchange={(e) => w.setRace(e.currentTarget.value)}
          ><option value="">Choose…</option>{#each Object.keys(RACES) as r (r)}<option>{r}</option
            >{/each}</select
        ></label
      >
      <label class="block text-sm"
        >Subrace
        <select
          class={input}
          bind:value={w.subrace}
          disabled={!w.race || !Object.keys(RACES[w.race].subraces).length}
        >
          <option value=""
            >{w.race && !Object.keys(RACES[w.race].subraces).length
              ? 'None for ' + w.race
              : 'Choose…'}</option
          >
          {#if w.race}{#each Object.keys(RACES[w.race].subraces) as s (s)}<option>{s}</option
              >{/each}{/if}</select
        ></label
      >
      <label class="block text-sm"
        >Class
        <select class={input} value={w.cls} onchange={(e) => w.setClass(e.currentTarget.value)}
          ><option value="">Choose…</option>{#each Object.keys(CLASSES) as c (c)}<option>{c}</option
            >{/each}</select
        ></label
      >
      <label class="block text-sm"
        >Background
        <select class={input} bind:value={w.background}
          ><option value="">Choose…</option><option>Acolyte</option></select
        ></label
      >
    </div>
    <label class="block text-sm"
      >Premise<textarea class={input} rows="2" bind:value={w.premise}></textarea></label
    >
    <label class="block text-sm"
      >Backstory<textarea class={input} rows="3" bind:value={w.backstory}></textarea></label
    >
    {#if !w.conceptValid}
      <p class="text-sm text-muted">
        Still needed to unlock the other steps: {w.conceptMissing.join(', ')}.
      </p>
    {/if}
  {:else if step === 'abilities'}
    <div class="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Method">
      {#each methods as [m, l] (m)}
        <Button
          size="sm"
          variant={w.method === m ? 'primary' : 'secondary'}
          onclick={() => w.setMethod(m)}>{l}</Button
        >
      {/each}
      {#if w.method === 'roll'}<Button size="sm" variant="ghost" onclick={() => w.roll()}
          >{w.rolled ? 'Reroll' : 'Roll'}</Button
        >{/if}
      {#if w.method === 'pointbuy'}<Badge variant={w.pbSpent > 27 ? 'danger' : 'info'}
          >{27 - w.pbSpent} points left</Badge
        >{/if}
    </div>
    {#if w.method === 'roll' && !w.rolled}
      <p class="text-sm text-muted">Rolls are made by the app and recorded on the character.</p>
    {:else}
      {#if w.method === 'roll'}<p class="text-sm text-muted">Rolled: {w.rolled?.join(', ')}</p>{/if}
      <table class="w-full text-sm">
        <thead class="text-left text-muted"
          ><tr><th>Ability</th><th>Base</th><th>Race</th><th>Total</th><th>Mod</th></tr></thead
        >
        <tbody>
          {#each ABILITIES as a (a)}
            {@const total = w.score(a)}
            <tr class="border-t border-border">
              <th class="py-1.5 text-left">{a}</th>
              <td>
                {#if w.method === 'pointbuy'}
                  <span class="inline-flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      aria-label="Decrease {a}"
                      disabled={w.pb[a] <= 8}
                      onclick={() => w.pb[a]--}>−</Button
                    >
                    <span class="w-6 text-center">{w.pb[a]}</span>
                    <Button
                      size="sm"
                      variant="secondary"
                      aria-label="Increase {a}"
                      disabled={w.pb[a] >= 15 ||
                        w.pbSpent - (POINT_COST[w.pb[a]] ?? 0) + (POINT_COST[w.pb[a] + 1] ?? 99) >
                          27}
                      onclick={() => w.pb[a]++}>+</Button
                    >
                  </span>
                {:else}
                  <select
                    class="rounded-control border border-control-border bg-raised px-2 py-1"
                    aria-label="{a} value"
                    value={w.assign[a] ?? ''}
                    onchange={(e) =>
                      (w.assign[a] =
                        e.currentTarget.value === '' ? null : Number(e.currentTarget.value))}
                  >
                    <option value="">—</option>
                    {#each w.pool as v, i (i)}
                      {#if !w.usedIdx(a).includes(i)}<option value={i}>{v}</option>{/if}
                    {/each}
                  </select>
                {/if}
              </td>
              <td class="text-muted">{w.racial(a) ? fmt(w.racial(a)) : ''}</td>
              <td class="font-semibold">{total ?? '—'}</td>
              <td>{total === null ? '' : fmt(w.stats.mods[a])}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  {:else if step === 'skills'}
    <p class="text-sm text-muted">
      Choose {w.cl?.skillCount}
      {w.cls} skills ({w.skills.length} picked). {w.background} already grants {BACKGROUND_SKILLS.join(
        ' and '
      )}.
    </p>
    <div class="flex flex-wrap gap-2">
      {#each [...new Set([...(w.cl?.skills ?? []), ...w.skills])] as s (s)}
        {@const bad = !w.cl?.skills.includes(s) || BACKGROUND_SKILLS.includes(s)}
        <button
          type="button"
          aria-pressed={w.skills.includes(s)}
          disabled={BACKGROUND_SKILLS.includes(s) && !w.skills.includes(s)}
          class="rounded-full border px-3 py-1 text-sm disabled:opacity-40 {w.skills.includes(s)
            ? bad
              ? 'border-warning bg-warning-bg'
              : 'border-transparent bg-primary text-on-primary'
            : 'border-control-border bg-raised'}"
          onclick={() => w.toggle(w.skills, s)}>{s}{bad && w.skills.includes(s) ? ' ⚠' : ''}</button
        >
      {/each}
    </div>
  {:else if step === 'equipment'}
    {#each w.cl?.equipment ?? [] as options, i (i)}
      <fieldset class="space-y-1">
        <legend class="text-sm text-muted">Choice {i + 1}</legend>
        {#each options as o, j (j)}
          <label class="flex items-center gap-2 text-sm"
            ><input
              type="radio"
              name="eq{i}"
              checked={w.equipment[i] === j}
              onchange={() => (w.equipment[i] = j)}
            />{o}</label
          >
        {/each}
      </fieldset>
    {/each}
  {:else if step === 'spells'}
    <p class="text-sm text-muted">
      Cantrips {w.cantrips.length}/{w.stats.cantripsAllowed} · Level 1 spells {w.spells.length}/{w
        .stats.spellsAllowed}
    </p>
    <div class="flex flex-wrap gap-2">
      {#each CANTRIPS as s (s)}
        <button
          type="button"
          aria-pressed={w.cantrips.includes(s)}
          class="rounded-full border px-3 py-1 text-sm {w.cantrips.includes(s)
            ? 'border-transparent bg-primary text-on-primary'
            : 'border-control-border bg-raised'}"
          onclick={() => w.toggle(w.cantrips, s)}>{s}</button
        >
      {/each}
    </div>
    <div class="flex flex-wrap gap-2">
      {#each SPELLS as s (s)}
        <button
          type="button"
          aria-pressed={w.spells.includes(s)}
          class="rounded-full border px-3 py-1 text-sm {w.spells.includes(s)
            ? 'border-transparent bg-primary text-on-primary'
            : 'border-control-border bg-raised'}"
          onclick={() => w.toggle(w.spells, s)}>{s}</button
        >
      {/each}
    </div>
  {:else}
    <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
      <dt class="text-muted">Name</dt>
      <dd>{w.name}</dd>
      <dt class="text-muted">Lineage</dt>
      <dd>{w.subrace || w.race} {w.cls}, {w.background}</dd>
      <dt class="text-muted">Scores</dt>
      <dd>{ABILITIES.map((a) => `${a} ${w.score(a)}`).join(' · ')}</dd>
      <dt class="text-muted">Skills</dt>
      <dd>{[...BACKGROUND_SKILLS, ...w.skills].join(', ')}</dd>
      <dt class="text-muted">Equipment</dt>
      <dd>{(w.cl?.equipment ?? []).map((o, i) => o[w.equipment[i] ?? 0]).join('; ')}</dd>
      {#if w.cl?.caster}<dt class="text-muted">Spells</dt>
        <dd>{[...w.cantrips, ...w.spells].join(', ')}</dd>{/if}
    </dl>
    <Button onclick={() => alert('Saved (prototype: nothing is stored).')}>Save character</Button>
  {/if}
  <span class="sr-only">{STEP_LABELS[step]}</span>
</div>
