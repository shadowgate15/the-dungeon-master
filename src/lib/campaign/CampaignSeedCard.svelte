<script lang="ts">
  import { LENGTHS, TONES } from '#lib/campaign/enums.ts'
  import type { FieldAi as FieldAiController } from '#lib/ai/field-ai.svelte.ts'
  import FieldAi from '#lib/ui/FieldAi.svelte'
  import { PREMISE_SOFT_CAP } from '#lib/world/enums.ts'
  import Alert from '#lib/ui/Alert.svelte'
  import Button from '#lib/ui/Button.svelte'
  import WorldPicker from './WorldPicker.svelte'
  import type { CampaignSeedCard, CampaignSeedField } from './seed.ts'

  type Props = {
    /** The live card. Fields are named name, premise, tone, length and worldId for form posts. */
    seed: CampaignSeedCard
    /** Active Worlds the player may choose. */
    worlds: { id: string; name: string }[]
    /** The form's per-field AI controller (see `createFieldAi`). */
    fieldAi: FieldAiController<CampaignSeedField>
  }

  let { seed = $bindable(), worlds, fieldAi }: Props = $props()

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

  const unspecified = { value: '', label: 'Choose…' }
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
  <FieldAi {...fieldAi.field('name')} label="Name" name="name" kind="text" bind:value={seed.name} />
  <FieldAi
    {...fieldAi.field('premise')}
    label="Premise"
    name="premise"
    kind="textarea"
    rows={4}
    bind:value={seed.premise}
  />
  {#if seed.premise.length > PREMISE_SOFT_CAP}
    <Alert variant="warning" role="status">
      Premise is long ({seed.premise.length} of about {PREMISE_SOFT_CAP} characters). You can still save
      it.
    </Alert>
  {/if}
  <div class="grid grid-cols-2 gap-3">
    {#each pickers as picker (picker.name)}
      <FieldAi
        {...fieldAi.field(picker.name)}
        label={picker.label}
        name={picker.name}
        kind="enum"
        options={[unspecified, ...picker.options.map((o) => ({ value: o, label: o }))]}
        bind:value={seed[picker.name]}
      />
    {/each}
  </div>
</div>
