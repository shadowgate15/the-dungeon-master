<script lang="ts">
  import {
    GENRE_FLAVORS,
    LENGTHS,
    MAGIC_LEVELS,
    PREMISE_SOFT_CAP,
    SCALES,
    TECH_LEVELS,
    TONES
  } from '#lib/campaign/enums.ts'
  import Alert from '#lib/ui/Alert.svelte'
  import Field from '#lib/ui/Field.svelte'
  import Select from '#lib/ui/Select.svelte'
  import Textarea from '#lib/ui/Textarea.svelte'
  import TextInput from '#lib/ui/TextInput.svelte'
  import { missingSeedFields, type CampaignSeedCard, type RequiredSeedField } from './seed.ts'

  type Props = {
    /** The live card. Inputs are named after the Seed fields for form posts. */
    seed: CampaignSeedCard
    /** Read-only: every field is disabled. */
    disabled?: boolean
    /** The fields the DM set, each marked "✎ DM". */
    dmFields?: readonly string[]
  }

  let { seed = $bindable(), disabled = false, dmFields = [] }: Props = $props()
  const dm = (field: keyof CampaignSeedCard) => dmFields.includes(field)

  const required = [
    { name: 'tone', label: 'Tone', options: TONES },
    { name: 'length', label: 'Length', options: LENGTHS }
  ] as const

  const world = [
    { name: 'genreFlavor', label: 'Genre flavor', options: GENRE_FLAVORS },
    { name: 'scale', label: 'Scale', options: SCALES },
    { name: 'magicLevel', label: 'Magic level', options: MAGIC_LEVELS },
    { name: 'techLevel', label: 'Tech level', options: TECH_LEVELS }
  ] as const

  const LABELS: Record<RequiredSeedField, string> = {
    name: 'Name',
    premise: 'Premise',
    tone: 'Tone',
    length: 'Length'
  }

  const missing = $derived(missingSeedFields(seed).map((f) => LABELS[f]))
  const list = (items: string[]) =>
    items.length === 1 ? items[0] : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`
</script>

{#snippet picker(
  p: { name: keyof CampaignSeedCard; label: string; options: readonly string[] },
  empty: string
)}
  <Field label={p.label} dm={dm(p.name)}>
    {#snippet children(id, describedby)}
      <Select
        {id}
        name={p.name}
        {disabled}
        aria-describedby={describedby}
        bind:value={seed[p.name]}
      >
        <option value="">{empty}</option>
        {#each p.options as option (option)}
          <option value={option}>{option}</option>
        {/each}
      </Select>
    {/snippet}
  </Field>
{/snippet}

<div class="space-y-3">
  <Field label="Name" dm={dm('name')}>
    {#snippet children(id, describedby)}
      <TextInput
        {id}
        name="name"
        {disabled}
        aria-describedby={describedby}
        bind:value={seed.name}
      />
    {/snippet}
  </Field>
  <Field label="Premise" dm={dm('premise')}>
    {#snippet children(id, describedby)}
      <Textarea
        {id}
        name="premise"
        rows={4}
        {disabled}
        aria-describedby={describedby}
        bind:value={seed.premise}
      />
    {/snippet}
  </Field>
  {#if seed.premise.length > PREMISE_SOFT_CAP}
    <Alert variant="warning">
      Premise is long ({seed.premise.length} of about {PREMISE_SOFT_CAP} characters). You can still save
      it.
    </Alert>
  {/if}
  <div class="grid grid-cols-2 gap-3">
    {#each required as p (p.name)}
      {@render picker(p, 'Choose…')}
    {/each}
  </div>

  <fieldset class="space-y-3 border-t border-border pt-3">
    <legend class="pr-2 text-sm text-muted">World (optional)</legend>
    <Field label="World name" dm={dm('worldName')}>
      {#snippet children(id, describedby)}
        <TextInput
          {id}
          name="worldName"
          {disabled}
          aria-describedby={describedby}
          bind:value={seed.worldName}
        />
      {/snippet}
    </Field>
    <div class="grid grid-cols-2 gap-3">
      {#each world as p (p.name)}
        {@render picker(p, 'Unspecified')}
      {/each}
    </div>
  </fieldset>

  <p role="status" class={['text-sm', missing.length === 0 ? 'text-success' : 'text-muted']}>
    {#if missing.length === 0}
      Seed complete
    {:else}
      Seed incomplete: still needs {list(missing)}.
    {/if}
  </p>
</div>
