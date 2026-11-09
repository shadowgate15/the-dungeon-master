<script lang="ts">
  import type { GrantSource, ResolvedGroup } from '#lib/rules/resolver.ts'
  import Alert from '#lib/ui/Alert.svelte'
  import Button from '#lib/ui/Button.svelte'
  import Checkbox from '#lib/ui/Checkbox.svelte'
  import Field from '#lib/ui/Field.svelte'
  import FieldAi from '#lib/ui/FieldAi.svelte'
  import Select from '#lib/ui/Select.svelte'
  import Textarea from '#lib/ui/Textarea.svelte'
  import { LIMITS } from './draft.ts'
  import { groupIssues, groupLabel, skillsStepGroups } from './steps.ts'
  import type { CharacterWizard } from './wizard.svelte.ts'

  let { wizard }: { wizard: CharacterWizard } = $props()

  const draft = $derived(wizard.draft)
  const rules = $derived(wizard.rules)
  const background = $derived(rules.backgrounds.find((b) => b.slug === draft.background))
  const groups = $derived(skillsStepGroups(wizard.resolved))

  const sections = $derived(
    (
      [
        ['race', `Race${draft.race ? `: ${name(rules.races, draft.race)}` : ''}`],
        ['class', `Class${draft.class ? `: ${name(rules.classes, draft.class)}` : ''}`],
        ['background', `Background${background ? `: ${background.name}` : ''}`]
      ] as [GrantSource, string][]
    ).map(([source, title]) => ({
      source,
      title,
      groups: groups.filter((g) => g.source === source)
    }))
  )

  function name(list: readonly { slug: string; name: string }[], slug: string) {
    return list.find((e) => e.slug === slug)?.name ?? slug
  }

  /** Toggles an option. A one-pick group swaps; a bigger group stops at its count. */
  function toggle(g: ResolvedGroup, slug: string) {
    const picks = g.picks.includes(slug)
      ? g.picks.filter((p) => p !== slug)
      : g.choose === 1
        ? [slug]
        : [...g.picks, slug]
    const next = { ...draft.picks }
    if (picks.length) next[g.key] = picks
    else delete next[g.key]
    wizard.update({ picks: next })
  }

  /** Why an option cannot be ticked now; a pick already made stays untickable-off, never stuck. */
  function blocked(g: ResolvedGroup, slug: string): string | null {
    if (g.picks.includes(slug)) return null
    const o = g.options.find((x) => x.slug === slug)
    if (o?.disabled === 'granted') return 'already granted'
    if (o?.disabled === 'chosen-elsewhere') return 'chosen elsewhere'
    if (g.choose > 1 && new Set(g.picks).size >= g.choose) return 'limit reached'
    return null
  }

  // Acolyte personality tables (SRD p.60): optional; the chosen text lands in the free-text field.
  const tables = [
    { kind: 'personalityTrait', field: 'personality', label: 'Personality traits' },
    { kind: 'ideal', field: 'ideal', label: 'Ideal' },
    { kind: 'bond', field: 'bond', label: 'Bond' },
    { kind: 'flaw', field: 'flaw', label: 'Flaw' }
  ] as const
  const entries = (kind: string) => background?.options.filter((o) => o.kind === kind) ?? []
  const showTables = $derived(!!background && background.slug !== 'custom')

  function roll(kind: string, field: (typeof tables)[number]['field']) {
    const list = entries(kind)
    if (!list.length) return
    wizard.update({ [field]: list[Math.floor(Math.random() * list.length)].text })
  }
</script>

<div class="space-y-6">
  {#if draft.background === 'custom'}
    <section class="space-y-3" aria-label="Custom background">
      <h3 class="font-display text-lg">Custom background</h3>
      <!-- Name first: the feature is generated given the name. -->
      <FieldAi
        {...wizard.aiField('customBackgroundName')}
        label="Background name"
        kind="text"
        bind:value={
          () => draft.customBackgroundName, (v) => wizard.update({ customBackgroundName: v })
        }
      />
      {#if draft.customBackgroundName.length > LIMITS.customBackgroundName}
        <p class="text-sm font-medium text-danger" role="alert">
          Over the {LIMITS.customBackgroundName} character limit.
        </p>
      {/if}
      <FieldAi
        {...wizard.aiField('customBackgroundFeature')}
        label="Background feature"
        kind="textarea"
        rows={3}
        bind:value={
          () => draft.customBackgroundFeature, (v) => wizard.update({ customBackgroundFeature: v })
        }
      />
      <p class="text-sm text-muted">
        Both required. The feature is free text; it has no game mechanics.
      </p>
      {#if draft.customBackgroundFeature.length > LIMITS.customBackgroundFeature}
        <p class="text-sm font-medium text-danger" role="alert">
          Over the {LIMITS.customBackgroundFeature} character limit.
        </p>
      {/if}
      <p class="text-sm text-muted">
        A custom background grants two skills and two tool or language proficiencies (below), plus a
        fixed package: common clothes and a pouch with 15 gp.
      </p>
    </section>
  {/if}

  {#each sections as section (section.source)}
    {#if section.groups.length}
      <section class="space-y-3" aria-label={section.title}>
        <h3 class="font-display text-lg">{section.title}</h3>
        {#each section.groups as g (g.key)}
          {@const issues = groupIssues(g)}
          <fieldset
            class="space-y-2 rounded-panel border border-border p-3"
            data-choice-key={g.key}
          >
            <legend class="px-1 font-medium">
              {groupLabel(g)}
              <span class="text-sm text-muted">
                ({new Set(g.picks).size} of {g.choose})
              </span>
            </legend>
            <div class="grid gap-x-4 gap-y-1 sm:grid-cols-2">
              {#each g.options as o (o.slug)}
                {@const why = blocked(g, o.slug)}
                <label class={['flex items-center gap-2', why && 'text-muted']}>
                  <Checkbox
                    checked={g.picks.includes(o.slug)}
                    disabled={!!why}
                    onchange={() => toggle(g, o.slug)}
                  />
                  <span
                    >{o.name.replace(/^Skill: /, '')}{#if why && why !== 'limit reached'}<span
                        class="text-sm"
                      >
                        ({why})</span
                      >{/if}</span
                  >
                </label>
              {/each}
            </div>
            {#if g.status === 'attention'}
              <Alert variant="danger">
                {#each issues as issue (issue)}<p>{issue}</p>{/each}
              </Alert>
            {/if}
          </fieldset>
        {/each}
      </section>
    {/if}
  {/each}

  {#if showTables}
    <section class="space-y-3" aria-label="Personality">
      <h3 class="font-display text-lg">
        Personality <span class="text-sm text-muted">(optional)</span>
      </h3>
      <p class="text-sm text-muted">
        Pick or roll from the {background?.name} tables, or write your own. Only the final text is saved.
      </p>
      {#each tables as t (t.kind)}
        <Field
          label={t.label}
          error={draft[t.field].length > LIMITS[t.field]
            ? `Over the ${LIMITS[t.field]} character limit.`
            : undefined}
        >
          {#snippet children(id, describedby)}
            <div class="space-y-2">
              <div class="flex gap-2">
                <Select
                  aria-label={`${t.label} table`}
                  value={entries(t.kind).some((o) => o.text === draft[t.field])
                    ? draft[t.field]
                    : ''}
                  onchange={(e) => {
                    const v = e.currentTarget.value
                    if (v) wizard.update({ [t.field]: v })
                  }}
                >
                  <option value="">From the table…</option>
                  {#each entries(t.kind) as o (o.text)}
                    <option value={o.text}>{o.text}</option>
                  {/each}
                </Select>
                <Button
                  type="button"
                  variant="secondary"
                  onclick={() => roll(t.kind, t.field)}
                  aria-label={`Roll ${t.label}`}
                >
                  Roll
                </Button>
              </div>
              <Textarea
                {id}
                aria-describedby={describedby}
                rows={2}
                value={draft[t.field]}
                oninput={(e) => wizard.update({ [t.field]: e.currentTarget.value })}
              />
            </div>
          {/snippet}
        </Field>
      {/each}
    </section>
  {/if}

  {#if groups.length === 0 && draft.background !== 'custom' && !showTables}
    <p class="text-muted">Nothing to choose here for this Character.</p>
  {/if}
</div>
