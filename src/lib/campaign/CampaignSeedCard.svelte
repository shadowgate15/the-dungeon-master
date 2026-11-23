<script lang="ts">
  import { LENGTHS, PREMISE_SOFT_CAP, TONES } from '#lib/campaign/enums.ts'
  import Alert from '#lib/ui/Alert.svelte'
  import Field from '#lib/ui/Field.svelte'
  import Select from '#lib/ui/Select.svelte'
  import Textarea from '#lib/ui/Textarea.svelte'
  import TextInput from '#lib/ui/TextInput.svelte'
  import type { CampaignSeedCard } from './seed.ts'

  type Props = {
    /** The live card. Fields are named name, premise, tone and length for form posts. */
    seed: CampaignSeedCard
  }

  let { seed = $bindable() }: Props = $props()

  const pickers = [
    { name: 'tone', label: 'Tone', options: TONES },
    { name: 'length', label: 'Length', options: LENGTHS }
  ] as const
</script>

<div class="space-y-3">
  <Field label="Name">
    {#snippet children(id, describedby)}
      <TextInput {id} name="name" aria-describedby={describedby} bind:value={seed.name} />
    {/snippet}
  </Field>
  <Field label="Premise">
    {#snippet children(id, describedby)}
      <Textarea
        {id}
        name="premise"
        rows={4}
        aria-describedby={describedby}
        bind:value={seed.premise}
      />
    {/snippet}
  </Field>
  {#if seed.premise.length > PREMISE_SOFT_CAP}
    <Alert variant="warning" role="status">
      Premise is long ({seed.premise.length} of about {PREMISE_SOFT_CAP} characters). You can still save
      it.
    </Alert>
  {/if}
  <div class="grid grid-cols-2 gap-3">
    {#each pickers as picker (picker.name)}
      <Field label={picker.label}>
        {#snippet children(id, describedby)}
          <Select
            {id}
            name={picker.name}
            aria-describedby={describedby}
            bind:value={seed[picker.name]}
          >
            <option value="">Choose…</option>
            {#each picker.options as option (option)}
              <option value={option}>{option}</option>
            {/each}
          </Select>
        {/snippet}
      </Field>
    {/each}
  </div>
</div>
