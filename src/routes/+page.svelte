<script lang="ts">
  import { enhance } from '$app/forms'

  let { data, form } = $props()
</script>

<main class="mx-auto max-w-xl space-y-6 p-6">
  <h1 class="text-2xl font-semibold">Worlds</h1>

  <form method="POST" action="?/createWorld" use:enhance class="space-y-2">
    <label class="block">
      <span class="block text-sm font-medium">Name</span>
      <input name="name" value={form?.name ?? ''} class="w-full rounded border p-2" />
    </label>
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
        <li>{world.name}</li>
      {/each}
    </ul>
  {/if}
</main>
