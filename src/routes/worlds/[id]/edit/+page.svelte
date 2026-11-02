<script lang="ts">
  import { enhance } from '$app/forms'
  import { resolve } from '$app/paths'
  import {
    GENRE_FLAVORS,
    MAGIC_LEVELS,
    PREMISE_SOFT_CAP,
    SCALES,
    TECH_LEVELS
  } from '#lib/world/enums.ts'

  let { data, form } = $props()

  // Failed saves echo what was typed; otherwise show the stored World.
  const current = $derived(
    (form && 'name' in form ? form : data.world) as unknown as Record<string, string | null>
  )
  let premise = $derived(current.premise ?? '')

  const pickers = [
    { name: 'genreFlavor', label: 'Genre flavor', options: GENRE_FLAVORS },
    { name: 'scale', label: 'Scale', options: SCALES },
    { name: 'magicLevel', label: 'Magic level', options: MAGIC_LEVELS },
    { name: 'techLevel', label: 'Tech level', options: TECH_LEVELS }
  ] as const
</script>

<main class="mx-auto max-w-xl space-y-6 p-6">
  <a href={resolve('/')} class="text-sm underline">Back to Worlds</a>
  <h1 class="text-2xl font-semibold">Edit {data.world.name}</h1>

  <p class="text-sm text-slate-600">
    Edits apply live. {data.affectedCampaigns}
    {data.affectedCampaigns === 1 ? 'Campaign' : 'Campaigns'} affected.
  </p>

  <form method="POST" action="?/save" use:enhance class="space-y-2">
    <label class="block">
      <span class="block text-sm font-medium">Name</span>
      <input name="name" value={current.name ?? ''} class="w-full rounded border p-2" />
    </label>
    <label class="block">
      <span class="block text-sm font-medium">Premise</span>
      <textarea name="premise" bind:value={premise} rows="4" class="w-full rounded border p-2"
      ></textarea>
    </label>
    {#if premise.length > PREMISE_SOFT_CAP}
      <p class="text-sm text-amber-600">
        Premise is long ({premise.length} of about {PREMISE_SOFT_CAP} characters). You can still save
        it.
      </p>
    {/if}
    {#each pickers as picker (picker.name)}
      <label class="block">
        <span class="block text-sm font-medium">{picker.label}</span>
        <select
          name={picker.name}
          value={current[picker.name] ?? ''}
          class="w-full rounded border p-2"
        >
          <option value="">Unspecified</option>
          {#each picker.options as option (option)}
            <option value={option}>{option}</option>
          {/each}
        </select>
      </label>
    {/each}
    {#if form?.error}
      <p role="alert" class="text-sm text-red-600">{form.error}</p>
    {/if}
    {#if form?.saved}
      <p role="status" class="text-sm text-green-700">Saved</p>
    {/if}
    <button type="submit" class="rounded bg-slate-800 px-3 py-2 text-white">Save changes</button>
  </form>
</main>
