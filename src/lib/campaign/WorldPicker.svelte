<script lang="ts">
  import Badge from '#lib/ui/Badge.svelte'
  import Button from '#lib/ui/Button.svelte'
  import Select from '#lib/ui/Select.svelte'

  type Props = {
    /** Every World the player may choose: active Worlds only. */
    worlds: { id: string; name: string }[]
    /** Chosen World ids, in the order chosen. */
    value: string[]
  }

  let { worlds, value = $bindable() }: Props = $props()

  const uid = $props.id()
  const labelId = `${uid}-label`

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

<div role="group" aria-labelledby={labelId} class="space-y-1">
  <span id={labelId} class="block text-sm font-medium text-text">Worlds</span>
  <div
    class="flex flex-wrap items-center gap-2 rounded-control border border-control-border bg-raised p-2"
  >
    {#each chosen as world (world.id)}
      <Badge class="gap-1 pr-1">
        {world.name}
        <input type="hidden" name="worldId" value={world.id} />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Remove {world.name}"
          disabled={value.length === 1}
          class="px-1.5! py-0! text-xs"
          onclick={() => (value = value.filter((id) => id !== world.id))}>✕</Button
        >
      </Badge>
    {/each}
    <Select
      size="sm"
      aria-label="Add World"
      bind:value={adding}
      onchange={add}
      disabled={addable.length === 0}
      class="w-auto"
    >
      <option value="">+ Add World</option>
      {#each addable as world (world.id)}
        <option value={world.id}>{world.name}</option>
      {/each}
    </Select>
  </div>
  {#if value.length === 0}
    <p class="text-sm font-medium text-danger">A Campaign needs at least one World</p>
  {:else if value.length === 1}
    <p class="text-sm text-muted">The last World can't be removed. Add another first to swap it.</p>
  {/if}
</div>
