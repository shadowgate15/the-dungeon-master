<script lang="ts">
  import { page } from '$app/state'
  import { replaceState } from '$app/navigation'
  import { resolve } from '$app/paths'
  import CampaignTable from '#lib/campaign/CampaignTable.svelte'
  import CampaignChat from '#lib/campaign/CampaignChat.svelte'
  import type { CampaignSeedCard, CampaignSeedField } from '#lib/campaign/seed.ts'
  import NewCampaignDialog from '#lib/campaign/NewCampaignDialog.svelte'
  import SectionNav from '#lib/SectionNav.svelte'

  let { data, form } = $props()

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
      : {}
  )
</script>

<main class="mx-auto max-w-6xl space-y-4 p-6">
  <SectionNav current="campaigns" />
  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-semibold">Campaigns</h1>
    <a
      href="{resolve('/campaigns')}?new"
      class="rounded bg-slate-800 px-3 py-2 text-white"
      onclick={(e) => {
        e.preventDefault()
        dialog?.show()
      }}>New Campaign</a
    >
  </div>

  <CampaignTable
    campaigns={data.campaigns}
    view={data.view}
    activeCount={data.activeCount}
    archivedCount={data.archivedCount}
  />
</main>

<NewCampaignDialog
  bind:this={dialog}
  worlds={data.worlds}
  {chat}
  initial={failedValues}
  error={createFailed && form ? form.error : undefined}
  open={serverOpen}
  onclose={() => {
    if (page.url.searchParams.has('new')) replaceState(resolve('/campaigns'), {})
  }}
/>

{#snippet chat(seed: CampaignSeedCard, onaccept: (field: CampaignSeedField, value: string) => void)}
  <CampaignChat {seed} {onaccept} />
{/snippet}
