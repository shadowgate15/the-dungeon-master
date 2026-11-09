<script lang="ts">
  import { resolve } from '$app/paths'
  import { enhance } from '$app/forms'
  import CharacterTable from '#lib/character/CharacterTable.svelte'
  import SectionNav from '#lib/SectionNav.svelte'
  import ActionToast from '#lib/world/ActionToast.svelte'
  import Button from '#lib/ui/Button.svelte'

  let { data, form } = $props()

  let confirmingDelete = $state<string | null>(null)
  // An action URL replaces the query string, so keep the view or the list would reset.
  const actionUrl = (name: string) => `?/${name}${data.view === 'archived' ? '&view=archived' : ''}`
</script>

{#snippet rowActions(character: { id: string })}
  {#if confirmingDelete === character.id}
    <form method="POST" action={actionUrl('delete')} use:enhance class="inline">
      <input type="hidden" name="id" value={character.id} />
      <span class="text-xs">Delete forever?</span>
      <Button type="submit" variant="danger" size="sm">Confirm delete</Button>
      <Button type="button" variant="ghost" size="sm" onclick={() => (confirmingDelete = null)}
        >Cancel</Button
      >
    </form>
  {:else}
    <form
      method="POST"
      action={actionUrl(data.view === 'active' ? 'archive' : 'restore')}
      use:enhance
      class="inline"
    >
      <input type="hidden" name="id" value={character.id} />
      <Button type="submit" variant="ghost" size="sm"
        >{data.view === 'active' ? 'Archive' : 'Restore'}</Button
      >
    </form>
    <Button
      type="button"
      variant="ghost"
      size="sm"
      class="text-danger"
      onclick={() => (confirmingDelete = character.id)}>Delete</Button
    >
  {/if}
{/snippet}

<main class="mx-auto max-w-6xl space-y-4 p-6">
  <SectionNav current="characters" />
  <div class="flex items-center justify-between">
    <h1 class="font-display text-2xl">Characters</h1>
    <Button href={resolve('/characters/new')}>New Character</Button>
  </div>

  <CharacterTable
    characters={data.characters}
    view={data.view}
    activeCount={data.activeCount}
    archivedCount={data.archivedCount}
    actions={rowActions}
  />
</main>

<ActionToast notice={form?.notice} view={data.view} />
