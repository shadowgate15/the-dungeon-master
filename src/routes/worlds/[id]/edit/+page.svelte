<script lang="ts">
  import { enhance } from '$app/forms'
  import { resolve } from '$app/paths'
  import Alert from '#lib/ui/Alert.svelte'
  import Button from '#lib/ui/Button.svelte'
  import Field from '#lib/ui/Field.svelte'
  import Link from '#lib/ui/Link.svelte'
  import Select from '#lib/ui/Select.svelte'
  import TextInput from '#lib/ui/TextInput.svelte'
  import Textarea from '#lib/ui/Textarea.svelte'
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
  <Link href={resolve('/')} class="text-sm">Back to Worlds</Link>
  <h1 class="font-display text-2xl font-semibold text-text">Edit {data.world.name}</h1>

  <p class="text-sm text-muted">
    Edits apply live. {data.affectedCampaigns}
    {data.affectedCampaigns === 1 ? 'Campaign' : 'Campaigns'} affected.
  </p>

  {#if archived}
    <Alert variant="warning" role="status" class="space-y-2">
      <p>This World is archived and read-only. Restore it to edit.</p>
      <form method="POST" action="?/restore" use:enhance>
        <Button type="submit" variant="secondary" size="sm">Restore</Button>
      </form>
    </Alert>
  {/if}

  <form method="POST" action="?/save" use:enhance class="space-y-2">
    <fieldset disabled={archived} class="space-y-2">
      <Field label="Name">
        {#snippet children(id)}
          <TextInput {id} name="name" value={current.name ?? ''} />
        {/snippet}
      </Field>
      <Field label="Premise">
        {#snippet children(id)}
          <Textarea {id} name="premise" bind:value={premise} rows={4} />
        {/snippet}
      </Field>
      {#if premise.length > PREMISE_SOFT_CAP}
        <Alert variant="warning" role="status">
          Premise is long ({premise.length} of about {PREMISE_SOFT_CAP} characters). You can still save
          it.
        </Alert>
      {/if}
      {#each pickers as picker (picker.name)}
        <Field label={picker.label}>
          {#snippet children(id)}
            <Select {id} name={picker.name} value={current[picker.name] ?? ''}>
              <option value="">Unspecified</option>
              {#each picker.options as option (option)}
                <option value={option}>{option}</option>
              {/each}
            </Select>
          {/snippet}
        </Field>
      {/each}
      {#if form?.error && !form?.inUse}
        <Alert variant="danger">{form.error}</Alert>
      {/if}
      {#if form?.saved}
        <Alert variant="success">Saved</Alert>
      {/if}
      {#if !archived}
        <Button type="submit">Save changes</Button>
      {/if}
    </fieldset>
  </form>

  <section class="space-y-2 border-t border-border pt-4">
    {#if !archived}
      <form method="POST" action="?/archive" use:enhance>
        <Button type="submit" variant="secondary">Archive World</Button>
      </form>
    {/if}

    {#if form?.inUse}
      <Alert variant="danger">
        This World is used by a Campaign and cannot be deleted. {archived
          ? 'Keep it archived instead.'
          : 'Archive it instead.'}
      </Alert>
    {/if}

    {#if confirmingDelete}
      <form method="POST" action="?/delete" use:enhance class="space-y-2">
        <p class="text-sm text-text">
          Permanently delete {data.world.name}? This cannot be undone.
        </p>
        <Button type="submit" variant="danger">Confirm delete</Button>
        <Button type="button" variant="secondary" onclick={() => (confirmingDelete = false)}
          >Cancel</Button
        >
      </form>
    {:else}
      <Button type="button" variant="secondary" onclick={() => (confirmingDelete = true)}
        >Delete World</Button
      >
    {/if}
  </section>
</main>
