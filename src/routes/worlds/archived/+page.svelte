<script lang="ts">
  import { enhance } from '$app/forms'
  import { resolve } from '$app/paths'

  let { data, form } = $props()
</script>

<main class="mx-auto max-w-xl space-y-6 p-6">
  <a href={resolve('/')} class="text-sm underline">Back to Worlds</a>
  <h1 class="text-2xl font-semibold">Archived Worlds</h1>

  {#if form?.error}
    <p role="alert" class="text-sm text-red-600">{form.error}</p>
  {/if}

  {#if data.worlds.length === 0}
    <p class="text-slate-500">No archived Worlds.</p>
  {:else}
    <ul aria-label="Archived Worlds" class="space-y-2">
      {#each data.worlds as world (world.id)}
        <li class="flex items-center justify-between gap-2">
          <a href={resolve('/worlds/[id]/edit', { id: world.id })} class="underline">{world.name}</a
          >
          <form method="POST" action="?/restore" use:enhance>
            <input type="hidden" name="id" value={world.id} />
            <button type="submit" class="rounded border px-3 py-1" aria-label="Restore {world.name}"
              >Restore</button
            >
          </form>
        </li>
      {/each}
    </ul>
  {/if}
</main>
