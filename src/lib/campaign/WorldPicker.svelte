<script lang="ts">
  type Props = {
    /** Every World the player may choose: active Worlds only. */
    worlds: { id: string; name: string }[]
    /** Chosen World ids, in the order chosen. */
    value: string[]
  }

  let { worlds, value = $bindable() }: Props = $props()

  const chosen = $derived(
    value.flatMap((id) => {
      const found = worlds.find((w) => w.id === id)
      return found ? [found] : []
    })
  )
  const addable = $derived(worlds.filter((w) => !value.includes(w.id)))
  let adding = $state('')

  function add() {
    if (adding) value = [...value, adding]
    adding = ''
  }
</script>

<div>
  <span class="block text-sm font-medium">Worlds</span>
  <div class="flex flex-wrap items-center gap-2 rounded border p-2">
    {#each chosen as world (world.id)}
      <span
        class="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-0.5 text-sm text-white"
      >
        {world.name}
        <input type="hidden" name="worldId" value={world.id} />
        <button
          type="button"
          aria-label="Remove {world.name}"
          disabled={value.length === 1}
          class="disabled:opacity-30"
          onclick={() => (value = value.filter((id) => id !== world.id))}>✕</button
        >
      </span>
    {/each}
    <select
      aria-label="Add World"
      bind:value={adding}
      onchange={add}
      disabled={addable.length === 0}
      class="rounded border p-1 text-sm"
    >
      <option value="">+ Add World</option>
      {#each addable as world (world.id)}
        <option value={world.id}>{world.name}</option>
      {/each}
    </select>
  </div>
  {#if value.length === 0}
    <p class="text-xs text-red-600">A Campaign needs at least one World</p>
  {:else if value.length === 1}
    <p class="text-xs text-slate-500">
      The last World can't be removed. Add another first to swap it.
    </p>
  {/if}
</div>
