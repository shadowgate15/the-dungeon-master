<script lang="ts">
  import { enhance } from '$app/forms'
  import AiPanel from '#lib/ai/AiPanel.svelte'
  import { resolve } from '$app/paths'
  import {
    GENRE_FLAVORS,
    MAGIC_LEVELS,
    PREMISE_SOFT_CAP,
    SCALES,
    TECH_LEVELS
  } from '#lib/world/enums.ts'

  let { data, form } = $props()

  let premise = $state('')

  const pickers = [
    { name: 'genreFlavor', label: 'Genre flavor', options: GENRE_FLAVORS },
    { name: 'scale', label: 'Scale', options: SCALES },
    { name: 'magicLevel', label: 'Magic level', options: MAGIC_LEVELS },
    { name: 'techLevel', label: 'Tech level', options: TECH_LEVELS }
  ] as const
</script>

<main class="mx-auto max-w-xl space-y-6 p-6">
  <h1 class="text-2xl font-semibold">Worlds</h1>

  <AiPanel />

  <form
    method="POST"
    action="?/createWorld"
    use:enhance
    onreset={() => (premise = '')}
    class="space-y-2"
  >
    <label class="block">
      <span class="block text-sm font-medium">Name</span>
      <input name="name" value={form?.name ?? ''} class="w-full rounded border p-2" />
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
          value={(form as Record<string, unknown> | null)?.[picker.name] ?? ''}
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
    <button type="submit" class="rounded bg-slate-800 px-3 py-2 text-white">Create World</button>
  </form>

  {#if data.worlds.length === 0}
    <p class="text-slate-500">No Worlds yet.</p>
  {:else}
    <ul aria-label="Worlds" class="space-y-1">
      {#each data.worlds as world (world.id)}
        <li>
          <a href={resolve('/worlds/[id]/edit', { id: world.id })} class="underline">{world.name}</a
          >
        </li>
      {/each}
    </ul>
  {/if}
</main>
