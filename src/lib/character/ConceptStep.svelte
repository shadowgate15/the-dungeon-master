<script lang="ts">
  import Field from '#lib/ui/Field.svelte'
  import Select from '#lib/ui/Select.svelte'
  import TextInput from '#lib/ui/TextInput.svelte'
  import Textarea from '#lib/ui/Textarea.svelte'
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

  const orNull = (e: Event) => (e.currentTarget as HTMLSelectElement).value || null
</script>

<div class="space-y-4">
  <Field label="Name" hint="Required. Names need not be unique.">
    {#snippet children(id, describedby)}
      <TextInput
        {id}
        aria-describedby={describedby}
        maxlength={LIMITS.name}
        value={draft.name}
        oninput={(e) => wizard.update({ name: e.currentTarget.value })}
      />
    {/snippet}
  </Field>

  <div class="grid gap-3 sm:grid-cols-2">
    <Field label="Race">
      {#snippet children(id)}
        <Select {id} value={draft.race ?? ''} onchange={(e) => wizard.update({ race: orNull(e) })}>
          <option value="">Choose…</option>
          {#each rules.races as race (race.slug)}
            <option value={race.slug}>{race.name}</option>
          {/each}
        </Select>
      {/snippet}
    </Field>

    {#if subraces.length > 0}
      <Field label="Subrace">
        {#snippet children(id)}
          <Select
            {id}
            value={draft.subrace ?? ''}
            onchange={(e) => wizard.update({ subrace: orNull(e) })}
          >
            <option value="">Choose…</option>
            {#each subraces as subrace (subrace.slug)}
              <option value={subrace.slug}>{subrace.name}</option>
            {/each}
          </Select>
        {/snippet}
      </Field>
    {/if}

    <Field label="Class">
      {#snippet children(id)}
        <Select
          {id}
          value={draft.class ?? ''}
          onchange={(e) => wizard.update({ class: orNull(e) })}
        >
          <option value="">Choose…</option>
          {#each rules.classes as cls (cls.slug)}
            <option value={cls.slug}>{cls.name}</option>
          {/each}
        </Select>
      {/snippet}
    </Field>

    {#if subclassGroup}
      <Field
        label="Subclass"
        hint={single ? 'The SRD offers only one, so it is selected for you.' : undefined}
      >
        {#snippet children(id, describedby)}
          <Select
            {id}
            aria-describedby={describedby}
            value={draft.subclass ?? ''}
            onchange={(e) => wizard.update({ subclass: orNull(e) })}
          >
            <option value="">Choose…</option>
            {#each subclassGroup.options as option (option.slug)}
              <option value={option.slug}>{option.name}</option>
            {/each}
          </Select>
        {/snippet}
      </Field>
    {/if}

    <Field label="Background">
      {#snippet children(id)}
        <Select
          {id}
          value={draft.background ?? ''}
          onchange={(e) => wizard.update({ background: orNull(e) })}
        >
          <option value="">Choose…</option>
          {#each rules.backgrounds as background (background.slug)}
            <option value={background.slug}>{background.name}</option>
          {/each}
        </Select>
      {/snippet}
    </Field>

    <Field label="Alignment" hint="Optional.">
      {#snippet children(id, describedby)}
        <Select
          {id}
          aria-describedby={describedby}
          value={draft.alignment ?? ''}
          onchange={(e) => wizard.update({ alignment: orNull(e) })}
        >
          <option value="">Unspecified</option>
          {#each rules.alignments as alignment (alignment.slug)}
            <option value={alignment.slug}>{alignment.name}</option>
          {/each}
        </Select>
      {/snippet}
    </Field>
  </div>

  <h3 class="font-display text-lg">Details <span class="text-sm text-muted">(optional)</span></h3>
  {#each text as field (field.key)}
    <Field
      label={field.label}
      error={draft[field.key].length > LIMITS[field.key]
        ? `Over the ${LIMITS[field.key]} character limit.`
        : undefined}
    >
      {#snippet children(id, describedby)}
        <Textarea
          {id}
          aria-describedby={describedby}
          rows={field.rows}
          value={draft[field.key]}
          oninput={(e) => wizard.update({ [field.key]: e.currentTarget.value })}
        />
      {/snippet}
    </Field>
  {/each}
</div>
