<script lang="ts">
  import { page } from '$app/state'
  import { replaceState } from '$app/navigation'
  import { resolve } from '$app/paths'
  import CampaignTable, { type CampaignListItem } from '#lib/campaign/CampaignTable.svelte'
  import NewCampaignDialog from '#lib/campaign/NewCampaignDialog.svelte'
  import { enhance } from '$app/forms'
  import ActionToast from '#lib/campaign/ActionToast.svelte'
  import Button from '#lib/ui/Button.svelte'
  import TextInput from '#lib/ui/TextInput.svelte'
  import { createSessionsQuery } from '#lib/live/client.ts'

  let { data, form } = $props()

  const sessions = createSessionsQuery(() => data.attached)

  /** The row whose Delete or Re-add is open, if any. */
  let confirming = $state<{ id: string; what: 'delete' | 'readd' } | null>(null)
  // An action URL replaces the query string, so keep the view or the list would reset.
  const actionUrl = (name: string) => `?/${name}${data.view === 'archived' ? '&view=archived' : ''}`

  let dialog = $state<NewCampaignDialog>()
  // A failed create reopens the dialog on the server render.
  const createFailed = $derived(form !== null && form !== undefined && 'error' in form)
  const serverOpen = $derived(page.url.searchParams.has('new') || createFailed)
  const failedValues = $derived(
    createFailed && form && 'name' in form
      ? { name: String(form.name ?? ''), folder: String(form.folder ?? '') }
      : {}
  )
</script>

{#snippet idField(campaign: CampaignListItem)}
  <input type="hidden" name="id" value={campaign.id} />
{/snippet}

{#snippet removeButton(campaign: CampaignListItem)}
  <form method="POST" action={actionUrl('unregister')} use:enhance class="inline">
    {@render idField(campaign)}
    <Button type="submit" variant="ghost" size="sm">Remove from library</Button>
  </form>
{/snippet}

{#snippet rowActions(campaign: CampaignListItem)}
  {#if confirming?.id === campaign.id && confirming.what === 'delete'}
    <form method="POST" action={actionUrl('delete')} use:enhance class="inline">
      {@render idField(campaign)}
      <span class="text-xs">Delete forever?</span>
      <Button type="submit" variant="danger" size="sm">Confirm delete</Button>
      <Button type="button" variant="ghost" size="sm" onclick={() => (confirming = null)}
        >Cancel</Button
      >
    </form>
  {:else if campaign.status === 'missing' && confirming?.id === campaign.id && confirming.what === 'readd'}
    <form
      method="POST"
      action={actionUrl('register')}
      use:enhance
      class="flex items-center justify-end gap-2"
    >
      <TextInput
        name="folder"
        size="sm"
        aria-label="Campaign folder"
        value={campaign.path}
        class="min-w-64"
      />
      <Button type="submit" variant="secondary" size="sm">Add</Button>
      <Button type="button" variant="ghost" size="sm" onclick={() => (confirming = null)}
        >Cancel</Button
      >
    </form>
  {:else if campaign.status === 'missing'}
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onclick={() => (confirming = { id: campaign.id, what: 'readd' })}>Re-add</Button
    >
    {@render removeButton(campaign)}
  {:else}
    <form
      method="POST"
      action={actionUrl(campaign.status === 'active' ? 'archive' : 'restore')}
      use:enhance
      class="inline"
    >
      {@render idField(campaign)}
      <Button type="submit" variant="ghost" size="sm"
        >{campaign.status === 'active' ? 'Archive' : 'Restore'}</Button
      >
    </form>
    {@render removeButton(campaign)}
    <Button
      type="button"
      variant="ghost"
      size="sm"
      class="text-danger"
      onclick={() => (confirming = { id: campaign.id, what: 'delete' })}>Delete</Button
    >
  {/if}
{/snippet}

<main class="mx-auto max-w-6xl space-y-4 p-6">
  <div class="flex items-center justify-between">
    <h1 class="font-display text-2xl">Campaigns</h1>
    <Button
      href="{resolve('/campaigns')}?new"
      onclick={(e: MouseEvent) => {
        e.preventDefault()
        dialog?.show()
      }}>New Campaign</Button
    >
  </div>

  <CampaignTable
    campaigns={data.campaigns}
    view={data.view}
    activeCount={data.activeCount}
    archivedCount={data.archivedCount}
    attached={sessions.data}
    actions={rowActions}
  />
</main>

<ActionToast notice={form && 'notice' in form ? form.notice : undefined} view={data.view} />

<NewCampaignDialog
  bind:this={dialog}
  root={data.campaignRoot}
  initial={failedValues}
  error={createFailed && form && 'error' in form ? form.error : undefined}
  open={serverOpen}
  onclose={() => {
    if (page.url.searchParams.has('new')) replaceState(resolve('/campaigns'), {})
  }}
/>
