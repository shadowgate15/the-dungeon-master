<script lang="ts">
  import { enhance } from '$app/forms'
  import { resolve } from '$app/paths'
  import Alert from '#lib/ui/Alert.svelte'
  import Button from '#lib/ui/Button.svelte'
  import Link from '#lib/ui/Link.svelte'
  import Select from '#lib/ui/Select.svelte'
  import SectionNav from '#lib/SectionNav.svelte'

  let { data, form } = $props()

  const locked = $derived(data.campaign.archived || data.campaign.readOnly)
  const when = (t: number) => new Date(t).toLocaleString()
</script>

<svelte:head><title>{data.campaign.name}</title></svelte:head>

<main class="mx-auto max-w-3xl space-y-6 p-6">
  <SectionNav current="campaigns" />
  <Link href={resolve('/campaigns')} class="text-sm">All Campaigns</Link>
  <header>
    <h1 class="font-display text-2xl">{data.campaign.name}</h1>
    <p class="text-muted">{data.campaign.premise}</p>
  </header>

  {#if locked}
    <Alert variant="warning">
      This Campaign is read-only, so it cannot be played. Restore it, or the Worlds it uses, to
      play.
    </Alert>
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
        You have no Characters yet. <Link href={resolve('/characters/new')}>Create one</Link>.
      </p>
    {:else if !locked && !data.openSessionId}
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
    {/if}
  </section>

  <section aria-label="Sessions" class="space-y-2">
    <h2 class="font-display text-lg">Sessions</h2>
    {#if data.openSessionId}
      <Button
        href={resolve('/campaigns/[id]/sessions/[sessionId]', {
          id: data.campaign.id,
          sessionId: data.openSessionId
        })}>Resume Session</Button
      >
    {:else}
      <form method="POST" action="?/startSession" use:enhance>
        <Button type="submit" disabled={locked || !data.linkedCharacter}>Start Session</Button>
      </form>
      {#if !data.linkedCharacter && !locked}
        <p class="text-sm text-muted">Link a Character to start a Session.</p>
      {/if}
    {/if}
    {#if data.sessions.length > 0}
      <ul class="space-y-1 text-sm">
        {#each [...data.sessions].reverse() as s (s.id)}
          <li>
            <Link
              href={resolve('/campaigns/[id]/sessions/[sessionId]', {
                id: data.campaign.id,
                sessionId: s.id
              })}>Session {s.number}</Link
            >
            <span class="text-muted">
              {s.endedAt === null ? 'open' : 'ended'} · started {when(s.startedAt)}
            </span>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</main>
