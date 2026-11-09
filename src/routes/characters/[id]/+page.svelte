<script lang="ts">
  import { onMount } from 'svelte'
  import { replaceState } from '$app/navigation'
  import { resolve } from '$app/paths'
  import { page } from '$app/state'
  import CharacterSummary from '#lib/character/CharacterSummary.svelte'
  import SectionNav from '#lib/SectionNav.svelte'
  import Alert from '#lib/ui/Alert.svelte'
  import Button from '#lib/ui/Button.svelte'
  import Link from '#lib/ui/Link.svelte'
  import Toast from '#lib/ui/Toast.svelte'
  import type { PageProps } from './$types'

  let { data }: PageProps = $props()

  // `?saved` comes from the wizard's save redirect; show the toast once, then drop it from the URL.
  let saved = $state(page.url.searchParams.has('saved'))
  onMount(() => {
    if (saved) replaceState(resolve('/characters/[id]', { id: data.id }), {})
  })
</script>

<svelte:head><title>{data.name}</title></svelte:head>

<main class="mx-auto max-w-4xl space-y-4 p-6">
  <SectionNav current="characters" />
  <Link href={resolve('/characters')}>All Characters</Link>
  {#if data.archived}
    <Alert variant="info">
      This Character is archived, so it is read-only. Restore it from the Characters list to edit
      it.
    </Alert>
  {/if}
  {#if !data.archived}
    <Button href={resolve('/characters/[id]/edit', { id: data.id })}>Edit</Button>
  {/if}
  <CharacterSummary model={data.summary} />
</main>

{#if saved}
  <Toast tone="success" onclose={() => (saved = false)}>Saved {data.name}</Toast>
{/if}
