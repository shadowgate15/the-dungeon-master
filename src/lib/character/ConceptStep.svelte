<script lang="ts">
  import FieldAi from '#lib/ui/FieldAi.svelte'
  import { LIMITS } from './draft.ts'
  import type { CharacterWizard } from './wizard.svelte.ts'

  let { wizard }: { wizard: CharacterWizard } = $props()

  const draft = $derived(wizard.draft)
  const rules = $derived(wizard.rules)
  const subraces = $derived(rules.subraces.filter((s) => s.race === draft.race))
  const subclassGroup = $derived(wizard.resolved.groups.find((g) => g.kind === 'subclass'))
  const single = $derived(subclassGroup?.options.length === 1)

  const text = [
    { key: 'appearance', label: 'Appearance', rows: 2 },
    { key: 'personality', label: 'Personality traits', rows: 2 },
    { key: 'ideal', label: 'Ideal', rows: 2 },
    { key: 'bond', label: 'Bond', rows: 2 },
    { key: 'flaw', label: 'Flaw', rows: 2 },
    { key: 'backstory', label: 'Backstory', rows: 5 }
  ] as const

  const choose = { value: '', label: 'Choose…' }
  const opts = (list: readonly { slug: string; name: string }[], first = choose) => [
    first,
    ...list.map((e) => ({ value: e.slug, label: e.name }))
  ]
</script>

<div class="space-y-4">
  <div>
    <FieldAi
      {...wizard.aiField('name')}
      label="Name"
      kind="text"
      bind:value={() => draft.name, (v) => wizard.update({ name: v })}
    />
    <p class="mt-1 text-sm text-muted">
      Required. Names need not be unique.
      {#if draft.name.length > LIMITS.name}
        <span class="text-danger">Over the {LIMITS.name} character limit.</span>
      {/if}
    </p>
  </div>

  <div class="grid gap-3 sm:grid-cols-2">
    <FieldAi
      {...wizard.aiField('race')}
      label="Race"
      kind="enum"
      options={opts(rules.races)}
      bind:value={() => draft.race ?? '', (v) => wizard.update({ race: v || null })}
    />

    {#if subraces.length > 0}
      <FieldAi
        {...wizard.aiField('subrace')}
        label="Subrace"
        kind="enum"
        options={opts(subraces)}
        bind:value={() => draft.subrace ?? '', (v) => wizard.update({ subrace: v || null })}
      />
    {/if}

    <FieldAi
      {...wizard.aiField('class')}
      label="Class"
      kind="enum"
      options={opts(rules.classes)}
      bind:value={() => draft.class ?? '', (v) => wizard.update({ class: v || null })}
    />

    {#if subclassGroup}
      <FieldAi
        {...wizard.aiField('subclass')}
        label="Subclass"
        kind="enum"
        options={opts(subclassGroup.options)}
        bind:value={() => draft.subclass ?? '', (v) => wizard.update({ subclass: v || null })}
      />
      {#if single}
        <p class="text-sm text-muted">The SRD offers only one, so it is selected for you.</p>
      {/if}
    {/if}

    <FieldAi
      {...wizard.aiField('background')}
      label="Background"
      kind="enum"
      options={opts(rules.backgrounds)}
      bind:value={() => draft.background ?? '', (v) => wizard.update({ background: v || null })}
    />

    <FieldAi
      {...wizard.aiField('alignment')}
      label="Alignment"
      kind="enum"
      options={opts(rules.alignments, { value: '', label: 'Unspecified' })}
      bind:value={() => draft.alignment ?? '', (v) => wizard.update({ alignment: v || null })}
    />
  </div>

  <h3 class="font-display text-lg">Details <span class="text-sm text-muted">(optional)</span></h3>
  {#each text as field (field.key)}
    <div>
      <FieldAi
        {...wizard.aiField(field.key)}
        label={field.label}
        kind="textarea"
        rows={field.rows}
        bind:value={() => draft[field.key], (v) => wizard.update({ [field.key]: v })}
      />
      {#if draft[field.key].length > LIMITS[field.key]}
        <p class="mt-1 text-sm text-danger" role="alert">
          Over the {LIMITS[field.key]} character limit.
        </p>
      {/if}
    </div>
  {/each}
</div>
