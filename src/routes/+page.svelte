<script lang="ts">
  import { enhance } from '$app/forms'
  import AiPanel from '#lib/ai/AiPanel.svelte'
  import CreationChat from '#lib/world/CreationChat.svelte'
  import { emptySeed, type SeedField } from '#lib/world/seed.ts'
  import { onMount } from 'svelte'
  import { page } from '$app/state'
  import { replaceState } from '$app/navigation'
  import { resolve } from '$app/paths'
  import SectionNav from '#lib/SectionNav.svelte'
  import ActionToast from '#lib/world/ActionToast.svelte'
  import WorldTable from '#lib/world/WorldTable.svelte'
  import {
    GENRE_FLAVORS,
    MAGIC_LEVELS,
    PREMISE_SOFT_CAP,
    SCALES,
    TECH_LEVELS
  } from '#lib/world/enums.ts'

  let { data, form } = $props()

  // The seed card's live values. The chat reads them and writes only accepted proposals.
  // Only the values of a failed no-JS submit seed it.
  // svelte-ignore state_referenced_locally
  let seed = $state({ ...emptySeed(), ...pickSeed(form) })
  // Bumped when a World is created, which remounts the chat and discards its transcript.
  let chatKey = $state(0)

  function pickSeed(values: unknown): Partial<Record<SeedField, string>> {
    const source = (values ?? {}) as Record<string, unknown>
    return Object.fromEntries(
      Object.entries(source).filter(([key, v]) => key in emptySeed() && typeof v === 'string')
    )
  }

  let dialog = $state<HTMLDialogElement>()
  // A failed create reopens the dialog on the server render; other failures belong to the table.
  const createFailed = $derived(form !== null && form !== undefined && 'error' in form)
  const serverOpen = $derived(page.url.searchParams.has('new') || createFailed)

  // The server renders the dialog open without JS; with JS it becomes a real modal.
  onMount(() => {
    if (dialog?.open) {
      dialog.close()
      dialog.showModal()
    }
  })

  const pickers = [
    { name: 'genreFlavor', label: 'Genre flavor', options: GENRE_FLAVORS },
    { name: 'scale', label: 'Scale', options: SCALES },
    { name: 'magicLevel', label: 'Magic level', options: MAGIC_LEVELS },
    { name: 'techLevel', label: 'Tech level', options: TECH_LEVELS }
  ] as const
</script>

<main class="mx-auto max-w-6xl space-y-4 p-6">
  <SectionNav current="worlds" />
  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-semibold">Worlds</h1>
    <a
      href="{resolve('/')}?new"
      class="rounded bg-slate-800 px-3 py-2 text-white"
      onclick={(e) => {
        e.preventDefault()
        dialog?.showModal()
      }}>New World</a
    >
  </div>

  <WorldTable
    worlds={data.worlds}
    view={data.view}
    activeCount={data.activeCount}
    archivedCount={data.archivedCount}
  />
</main>

<ActionToast notice={form?.notice} view={data.view} />

<dialog
  bind:this={dialog}
  open={serverOpen}
  aria-label="New World"
  onclose={() => {
    if (page.url.searchParams.has('new')) replaceState(resolve('/'), {})
  }}
  class="m-auto w-[min(72rem,calc(100vw-2rem))] rounded-lg p-6 backdrop:bg-black/50"
>
  <div class="mb-4 flex items-center justify-between">
    <h2 class="text-xl font-semibold">New World</h2>
    <a
      href={resolve('/')}
      onclick={(e) => {
        e.preventDefault()
        dialog?.close()
      }}
      class="text-sm underline">Close</a
    >
  </div>
  <div class="grid gap-6 lg:grid-cols-2">
    <div class="space-y-2 lg:max-h-[70vh] lg:overflow-y-auto">
      <AiPanel>
        {#snippet chat(status, ai)}
          {#key chatKey}
            <CreationChat
              {seed}
              onaccept={(field, value) => (seed[field as SeedField] = value)}
              disabled={status.state !== 'ready'}
              contextLength={status.state === 'ready' ? status.contextLength : null}
              fallbackContextLength={status.state === 'ready'
                ? status.fallbackContextLength
                : undefined}
              onreasoningmodel={ai.reasoningModel}
              onunavailable={ai.unavailable}
            />
          {/key}
        {/snippet}
      </AiPanel>
    </div>
    <div class="lg:max-h-[70vh] lg:overflow-y-auto">
      <form
        method="POST"
        action="?/createWorld"
        use:enhance={() =>
          async ({ result, update }) => {
            await update()
            if (result.type === 'success') dialog?.close()
          }}
        onreset={() => {
          seed = emptySeed()
          chatKey++
        }}
        class="space-y-2"
      >
        <label class="block">
          <span class="block text-sm font-medium">Name</span>
          <input name="name" bind:value={seed.name} class="w-full rounded border p-2" />
        </label>
        <label class="block">
          <span class="block text-sm font-medium">Premise</span>
          <textarea
            name="premise"
            bind:value={seed.premise}
            rows="4"
            class="w-full rounded border p-2"></textarea>
        </label>
        {#if seed.premise.length > PREMISE_SOFT_CAP}
          <p class="text-sm text-amber-600">
            Premise is long ({seed.premise.length} of about {PREMISE_SOFT_CAP} characters). You can still
            save it.
          </p>
        {/if}
        {#each pickers as picker (picker.name)}
          <label class="block">
            <span class="block text-sm font-medium">{picker.label}</span>
            <select
              name={picker.name}
              bind:value={seed[picker.name]}
              class="w-full rounded border p-2"
            >
              <option value="">Unspecified</option>
              {#each picker.options as option (option)}
                <option value={option}>{option}</option>
              {/each}
            </select>
          </label>
        {/each}
        {#if createFailed && form?.error}
          <p role="alert" class="text-sm text-red-600">{form.error}</p>
        {/if}
        <button type="submit" class="rounded bg-slate-800 px-3 py-2 text-white">Create World</button
        >
      </form>
    </div>
  </div>
</dialog>
