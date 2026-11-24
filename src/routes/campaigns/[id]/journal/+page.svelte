<script lang="ts">
  import { resolve } from '$app/paths'
  import Journal from '#lib/play/Journal.svelte'
  import { createJournalQuery } from '#lib/play/floor-client.ts'
  import Link from '#lib/ui/Link.svelte'

  let { data } = $props()

  const journal = createJournalQuery(
    () => data.campaign.id,
    () => data.journal
  )
</script>

<svelte:head><title>{data.campaign.name} · Journal</title></svelte:head>

<div class="mx-auto flex max-w-2xl flex-col gap-4 p-4">
  <header class="flex items-center gap-3">
    <h1 class="text-xl font-semibold">Journal</h1>
    <Link href={resolve('/campaigns/[id]/play', { id: data.campaign.id })} class="ml-auto text-sm"
      >Back to the play console</Link
    >
  </header>
  <p class="text-sm text-muted">What your Characters believe, as they learned it.</p>
  <Journal entries={journal.data.entries} />
</div>
