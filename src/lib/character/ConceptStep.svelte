<script lang="ts">
  import Field from '#lib/ui/Field.svelte'
  import Select from '#lib/ui/Select.svelte'
  import Textarea from '#lib/ui/Textarea.svelte'
  import TextInput from '#lib/ui/TextInput.svelte'
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

  const dm = (field: string) => wizard.dmFields.includes(field)

  const choose = { value: '', label: 'Choose…' }
  const opts = (list: readonly { slug: string; name: string }[], first = choose) => [
    first,
    ...list.map((e) => ({ value: e.slug, label: e.name }))
  ]
</script>

{#snippet select(
  field: string,
  label: string,
  options: { value: string; label: string }[],
  value: string,
  set: (v: string) => void
)}
  <Field {label} dm={dm(field)}>
    {#snippet children(id, describedby)}
      <Select {id} aria-describedby={describedby} bind:value={() => value, set}>
        {#each options as option (option.value)}
          <option value={option.value}>{option.label}</option>
        {/each}
      </Select>
    {/snippet}
  </Field>
{/snippet}

<div class="space-y-4">
  <div>
    <Field label="Name" dm={dm('name')}>
      {#snippet children(id, describedby)}
        <TextInput
          {id}
          aria-describedby={describedby}
          bind:value={() => draft.name, (v) => wizard.update({ name: v })}
        />
      {/snippet}
    </Field>
    <p class="mt-1 text-sm text-muted">
      Required. Names need not be unique.
      {#if draft.name.length > LIMITS.name}
        <span class="text-danger">Over the {LIMITS.name} character limit.</span>
      {/if}
    </p>
  </div>

  <div class="grid gap-3 sm:grid-cols-2">
    {@render select('race', 'Race', opts(rules.races), draft.race ?? '', (v) =>
      wizard.update({ race: v || null })
    )}

    {#if subraces.length > 0}
      {@render select('subrace', 'Subrace', opts(subraces), draft.subrace ?? '', (v) =>
        wizard.update({ subrace: v || null })
      )}
    {/if}

    {@render select('class', 'Class', opts(rules.classes), draft.class ?? '', (v) =>
      wizard.update({ class: v || null })
    )}

    {#if subclassGroup}
      {@render select(
        'subclass',
        'Subclass',
        opts(subclassGroup.options),
        draft.subclass ?? '',
        (v) => wizard.update({ subclass: v || null })
      )}
      {#if single}
        <p class="text-sm text-muted">The SRD offers only one, so it is selected for you.</p>
      {/if}
    {/if}

    {@render select(
      'background',
      'Background',
      opts(rules.backgrounds),
      draft.background ?? '',
      (v) => wizard.update({ background: v || null })
    )}

    {@render select(
      'alignment',
      'Alignment',
      opts(rules.alignments, { value: '', label: 'Unspecified' }),
      draft.alignment ?? '',
      (v) => wizard.update({ alignment: v || null })
    )}
  </div>

  <h3 class="font-display text-lg">Details <span class="text-sm text-muted">(optional)</span></h3>
  {#each text as field (field.key)}
    <div>
      <Field label={field.label} dm={dm(field.key)}>
        {#snippet children(id, describedby)}
          <Textarea
            {id}
            rows={field.rows}
            aria-describedby={describedby}
            bind:value={() => draft[field.key], (v) => wizard.update({ [field.key]: v })}
          />
        {/snippet}
      </Field>
      {#if draft[field.key].length > LIMITS[field.key]}
        <p class="mt-1 text-sm text-danger" role="alert">
          Over the {LIMITS[field.key]} character limit.
        </p>
      {/if}
    </div>
  {/each}
</div>
