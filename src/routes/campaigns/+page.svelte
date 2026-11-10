<script lang="ts">
  import { page } from '$app/state'
  import { replaceState } from '$app/navigation'
  import { resolve } from '$app/paths'
  import CampaignTable from '#lib/campaign/CampaignTable.svelte'
  import NewCampaignDialog from '#lib/campaign/NewCampaignDialog.svelte'
  import SectionNav from '#lib/SectionNav.svelte'
  import { enhance } from '$app/forms'
  import ActionToast from '#lib/world/ActionToast.svelte'
  import Button from '#lib/ui/Button.svelte'

  let { data, form } = $props()

  let confirmingDelete = $state<string | null>(null)
  // An action URL replaces the query string, so keep the view and filter or the list would reset.
  const actionUrl = (name: string) => {
    const keep = [
      data.view === 'archived' ? 'view=archived' : '',
      data.worldFilter ? `world=${encodeURIComponent(data.worldFilter.id)}` : ''
    ].filter(Boolean)
    return `?/${name}${keep.length ? `&${keep.join('&')}` : ''}`
  }
  // Only an active World can be pre-selected in the New Campaign dialog.
  const filterWorldIds = $derived(
    data.worldFilter && data.worlds.some((w) => w.id === data.worldFilter?.id)
      ? [data.worldFilter.id]
      : []
  )

  let dialog = $state<NewCampaignDialog>()
  // A failed create reopens the dialog on the server render.
  const createFailed = $derived(form !== null && form !== undefined && 'error' in form)
  const serverOpen = $derived(page.url.searchParams.has('new') || createFailed)
  const failedValues = $derived(
    createFailed && form
      ? {
          name: String(form.name ?? ''),
          premise: String(form.premise ?? ''),
          tone: String(form.tone ?? ''),
          length: String(form.length ?? ''),
          worldIds: Array.isArray(form.worldIds) ? form.worldIds.map(String) : []
        }
      : // A list filtered by a World opens the dialog with that World chosen.
        { worldIds: filterWorldIds }
  )
</script>

{#snippet rowActions(campaign: { id: string })}
  {#if confirmingDelete === campaign.id}
    <form method="POST" action={actionUrl('delete')} use:enhance class="inline">
      <input type="hidden" name="id" value={campaign.id} />
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
      <input type="hidden" name="id" value={campaign.id} />
      <Button type="submit" variant="ghost" size="sm"
        >{data.view === 'active' ? 'Archive' : 'Restore'}</Button
      >
    </form>
    <Button
      type="button"
      variant="ghost"
      size="sm"
      class="text-danger"
      onclick={() => (confirmingDelete = campaign.id)}>Delete</Button
    >
  {/if}
{/snippet}

<main class="mx-auto max-w-6xl space-y-4 p-6">
  <SectionNav current="campaigns" />
  <div class="flex items-center justify-between">
    <h1 class="font-display text-2xl">Campaigns</h1>
    <Button
      href="{resolve('/campaigns')}?new"
      onclick={(e: MouseEvent) => {
        e.preventDefault()
        dialog?.show(filterWorldIds)
      }}>New Campaign</Button
    >
  </div>

  <CampaignTable
    campaigns={data.campaigns}
    view={data.view}
    activeCount={data.activeCount}
    archivedCount={data.archivedCount}
    worldFilter={data.worldFilter}
    actions={rowActions}
  />
</main>

<ActionToast notice={form?.notice} view={data.view} />

<NewCampaignDialog
  bind:this={dialog}
  worlds={data.worlds}
  initial={failedValues}
  error={createFailed && form ? form.error : undefined}
  open={serverOpen}
  onclose={() => {
    if (page.url.searchParams.has('new')) replaceState(resolve('/campaigns'), {})
  }}
/>
