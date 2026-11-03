<script lang="ts">
  import { LENGTHS, TONES } from '#lib/campaign/enums.ts'
  import { PREMISE_SOFT_CAP } from '#lib/world/enums.ts'
  import Alert from '#lib/ui/Alert.svelte'
  import Button from '#lib/ui/Button.svelte'
  import Field from '#lib/ui/Field.svelte'
  import Select from '#lib/ui/Select.svelte'
  import TextInput from '#lib/ui/TextInput.svelte'
  import Textarea from '#lib/ui/Textarea.svelte'
  import WorldPicker from './WorldPicker.svelte'
  import type { CampaignSeedCard } from './seed.ts'

  type Props = {
    /** The live card. Fields are named name, premise, tone, length and worldId for form posts. */
    seed: CampaignSeedCard
    /** Active Worlds the player may choose. */
    worlds: { id: string; name: string }[]
  }

  let { seed = $bindable(), worlds }: Props = $props()

  // Worlds that became unavailable (archived or deleted elsewhere) drop out of the selection
  // when the list reloads, so the player is never stuck with a chip they cannot see or remove.
  // The player is told which ones were removed, never left to wonder.
  const names: Record<string, string> = {}
  let removed = $state<string[]>([])

  $effect(() => {
    for (const w of worlds) names[w.id] = w.name
    const available = new Set(worlds.map((w) => w.id))
    const gone = seed.worldIds.filter((id) => !available.has(id))
    if (gone.length > 0) {
      removed = [...new Set([...removed, ...gone.map((id) => names[id] ?? 'a World')])]
      seed.worldIds = seed.worldIds.filter((id) => available.has(id))
    }
  })

  const pickers = [
    { name: 'tone', label: 'Tone', options: TONES },
    { name: 'length', label: 'Length', options: LENGTHS }
  ] as const
</script>

<div class="space-y-3">
  <WorldPicker {worlds} bind:value={seed.worldIds} />
  {#if removed.length > 0}
    <Alert variant="warning" role="status" class="flex items-start justify-between gap-2">
      <span>
        Removed from this Campaign because {removed.length === 1 ? 'it was' : 'they were'} archived or
        deleted: {removed.join(', ')}. Choose another World to continue.
      </span>
      <Button type="button" variant="ghost" size="sm" onclick={() => (removed = [])}>Dismiss</Button
      >
    </Alert>
  {/if}
  <Field label="Name">
    {#snippet children(id)}
      <TextInput {id} name="name" bind:value={seed.name} />
    {/snippet}
  </Field>
  <Field label="Premise">
    {#snippet children(id)}
      <Textarea {id} name="premise" bind:value={seed.premise} rows={4} />
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
        {#snippet children(id)}
          <Select {id} name={picker.name} bind:value={seed[picker.name]}>
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
