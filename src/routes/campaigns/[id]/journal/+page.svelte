<script lang="ts">
  import { resolve } from '$app/paths'
  import Journal from '#lib/play/Journal.svelte'
  import SessionHistory from '#lib/play/SessionHistory.svelte'
  import { createJournalQuery, createSessionHistoryQuery } from '#lib/play/floor-client.ts'
  import Link from '#lib/ui/Link.svelte'

  let { data } = $props()

  const journal = createJournalQuery(
    () => data.campaign.id,
    () => data.journal
  )
  const history = createSessionHistoryQuery(
    () => data.campaign.id,
    () => data.sessions
  )
</script>

<svelte:head><title>{data.campaign.name} · Journal</title></svelte:head>

<div class="mx-auto flex max-w-5xl flex-col gap-4 p-4">
  <header class="flex items-center gap-3">
    <h1 class="text-xl font-semibold">Journal</h1>
    <Link href={resolve('/campaigns/[id]/play', { id: data.campaign.id })} class="ml-auto text-sm"
      >Back to the play console</Link
    >
  </header>
  <div class="grid gap-6 lg:grid-cols-2">
    <section aria-label="Journal" class="flex flex-col gap-3">
      <p class="text-sm text-muted">What your Characters believe, as they learned it.</p>
      <Journal entries={journal.data.entries} />
    </section>
    <section aria-labelledby="history-heading" class="flex flex-col gap-3">
      <h2 id="history-heading" class="text-lg font-semibold">Session history</h2>
      <SessionHistory sessions={history.data.sessions} />
    </section>
  </div>
</div>
