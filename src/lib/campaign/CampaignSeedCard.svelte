<script lang="ts">
  import { LENGTHS, TONES } from '#lib/campaign/enums.ts'
  import { PREMISE_SOFT_CAP } from '#lib/world/enums.ts'
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
</script>

<div class="space-y-3">
  <WorldPicker {worlds} bind:value={seed.worldIds} />
  {#if removed.length > 0}
    <p role="status" class="flex items-start justify-between gap-2 text-sm text-amber-600">
      <span>
        Removed from this Campaign because {removed.length === 1 ? 'it was' : 'they were'} archived or
        deleted: {removed.join(', ')}. Choose another World to continue.
      </span>
      <button type="button" class="underline" onclick={() => (removed = [])}>Dismiss</button>
    </p>
  {/if}
  <label class="block">
    <span class="block text-sm font-medium">Name</span>
    <input name="name" bind:value={seed.name} class="w-full rounded border p-2" />
  </label>
  <label class="block">
    <span class="block text-sm font-medium">Premise</span>
    <textarea name="premise" bind:value={seed.premise} rows="4" class="w-full rounded border p-2"
    ></textarea>
  </label>
  {#if seed.premise.length > PREMISE_SOFT_CAP}
    <p class="text-sm text-amber-600">
      Premise is long ({seed.premise.length} of about {PREMISE_SOFT_CAP} characters). You can still save
      it.
    </p>
  {/if}
  <div class="grid grid-cols-2 gap-3">
    <label class="block">
      <span class="block text-sm font-medium">Tone</span>
      <select name="tone" bind:value={seed.tone} class="w-full rounded border p-2">
        <option value="">Choose…</option>
        {#each TONES as tone (tone)}
          <option value={tone}>{tone}</option>
        {/each}
      </select>
    </label>
    <label class="block">
      <span class="block text-sm font-medium">Length</span>
      <select name="length" bind:value={seed.length} class="w-full rounded border p-2">
        <option value="">Choose…</option>
        {#each LENGTHS as length (length)}
          <option value={length}>{length}</option>
        {/each}
      </select>
    </label>
  </div>
</div>
