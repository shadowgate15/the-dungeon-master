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
  const archived = $derived(data.world.archivedAt !== null)
  let confirmingDelete = $state(false)

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

  {#if archived}
    <div role="status" class="space-y-2 rounded border border-amber-400 p-3">
      <p class="text-sm">This World is archived and read-only. Restore it to edit.</p>
      <form method="POST" action="?/restore" use:enhance>
        <button type="submit" class="rounded border px-3 py-1">Restore</button>
      </form>
    </div>
  {/if}

  <form method="POST" action="?/save" use:enhance class="space-y-2">
    <fieldset disabled={archived} class="space-y-2">
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
      {#if form?.error && !form?.inUse}
        <p role="alert" class="text-sm text-red-600">{form.error}</p>
      {/if}
      {#if form?.saved}
        <p role="status" class="text-sm text-green-700">Saved</p>
      {/if}
      {#if !archived}
        <button type="submit" class="rounded bg-slate-800 px-3 py-2 text-white">Save changes</button
        >
      {/if}
    </fieldset>
  </form>

  <section class="space-y-2 border-t pt-4">
    {#if !archived}
      <form method="POST" action="?/archive" use:enhance>
        <button type="submit" class="rounded border px-3 py-1">Archive World</button>
      </form>
    {/if}

    {#if form?.inUse}
      <div role="alert" class="space-y-2 text-sm text-red-600">
        <p>
          This World is used by a Campaign and cannot be deleted. {archived
            ? 'Keep it archived instead.'
            : 'Archive it instead.'}
        </p>
      </div>
    {/if}

    {#if confirmingDelete}
      <form method="POST" action="?/delete" use:enhance class="space-y-2">
        <p class="text-sm">Permanently delete {data.world.name}? This cannot be undone.</p>
        <button type="submit" class="rounded bg-red-700 px-3 py-1 text-white">Confirm delete</button
        >
        <button
          type="button"
          class="rounded border px-3 py-1"
          onclick={() => (confirmingDelete = false)}>Cancel</button
        >
      </form>
    {:else}
      <button
        type="button"
        class="rounded border px-3 py-1"
        onclick={() => (confirmingDelete = true)}>Delete World</button
      >
    {/if}
  </section>
</main>
