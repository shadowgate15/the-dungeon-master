<script lang="ts">
  import { enhance } from '$app/forms'
  import { resolve } from '$app/paths'
  import Alert from '#lib/ui/Alert.svelte'
  import Button from '#lib/ui/Button.svelte'
  import Link from '#lib/ui/Link.svelte'
  import Select from '#lib/ui/Select.svelte'

  let { data, form } = $props()

  const newCharacterHref = $derived(
    `${resolve('/characters/new')}?campaign=${encodeURIComponent(data.campaign.id)}`
  )
</script>

<svelte:head><title>{data.campaign.name}</title></svelte:head>

<main class="mx-auto max-w-3xl space-y-6 p-6">
  <Link href={resolve('/campaigns')} class="text-sm">All Campaigns</Link>
  <header>
    <h1 class="font-display text-2xl">{data.campaign.name}</h1>
    <p class="text-muted">{data.campaign.premise}</p>
  </header>

  {#if data.campaign.archived}
    <Alert variant="warning">This Campaign is archived. Restore it to change it.</Alert>
  {/if}
  {#if form && 'error' in form && form.error}
    <Alert variant="danger">{form.error}</Alert>
  {/if}

  <section aria-label="Character" class="space-y-2">
    <h2 class="font-display text-lg">Character</h2>
    {#if data.linkedCharacter}
      <p>Playing as <strong>{data.linkedCharacter.name}</strong>.</p>
    {:else}
      <p class="text-muted">No Character linked yet.</p>
    {/if}
    {#if data.characters.length === 0}
      <p class="text-sm">
        You have no Characters yet. <Link href={newCharacterHref}>Create one</Link>.
      </p>
    {:else if !data.campaign.archived}
      <form method="POST" action="?/linkCharacter" use:enhance class="flex items-end gap-2">
        <label class="flex-1 text-sm">
          Character
          <Select name="characterId" value={data.linkedCharacter?.id ?? data.characters[0].id}>
            {#each data.characters as c (c.id)}
              <option value={c.id}>{c.name}</option>
            {/each}
          </Select>
        </label>
        <Button type="submit" variant="secondary">Link Character</Button>
      </form>
      {#if data.linkedCharacter}
        <form method="POST" action="?/unlinkCharacter" use:enhance>
          <Button type="submit" variant="secondary">Unlink Character</Button>
        </form>
      {/if}
      <p class="text-sm"><Link href={newCharacterHref}>Create a new Character</Link></p>
    {/if}
  </section>
</main>
