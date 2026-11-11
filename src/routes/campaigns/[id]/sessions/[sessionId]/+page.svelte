<script lang="ts">
  import { enhance } from '$app/forms'
  import { resolve } from '$app/paths'
  import Alert from '#lib/ui/Alert.svelte'
  import Button from '#lib/ui/Button.svelte'
  import Link from '#lib/ui/Link.svelte'
  import CharacterSheetPanel from '#lib/session/CharacterSheetPanel.svelte'
  import PlayLayout from '#lib/session/PlayLayout.svelte'

  let { data } = $props()

  const ended = $derived(data.session.endedAt !== null)
</script>

<svelte:head><title>{data.campaign.name}: Session {data.session.number}</title></svelte:head>

<main class="mx-auto max-w-6xl space-y-3 p-4 sm:p-6">
  <div class="flex items-center justify-between gap-2">
    <div>
      <Link href={resolve('/campaigns/[id]', { id: data.campaign.id })} class="text-sm"
        >{data.campaign.name}</Link
      >
      <h1 class="font-display text-xl">Session {data.session.number}</h1>
    </div>
    {#if !ended}
      <form method="POST" action="?/end" use:enhance>
        <Button type="submit" variant="secondary" size="sm">End Session</Button>
      </form>
    {/if}
  </div>

  <PlayLayout>
    {#snippet narrative()}
      {#if ended}
        <Alert variant="info">Session ended. This transcript is read-only.</Alert>
      {/if}
      <ol aria-label="Transcript" class="space-y-3">
        {#each data.turns as t (t.id)}
          <li
            class={t.author === 'dm'
              ? 'max-w-prose'
              : 'ml-auto max-w-prose rounded-control bg-raised p-2 text-right'}
          >
            <div class="text-xs text-muted uppercase">
              {t.author === 'dm' ? 'Dungeon Master' : 'You'}
            </div>
            <p>{t.text}</p>
          </li>
        {/each}
      </ol>
      {#if data.turns.length === 0}
        <p class="text-muted">Nothing has happened yet.</p>
      {/if}
    {/snippet}
    {#snippet sheet()}
      <CharacterSheetPanel model={data.sheet} />
    {/snippet}
  </PlayLayout>
</main>
