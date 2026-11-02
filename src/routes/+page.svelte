<script lang="ts">
  import { enhance } from '$app/forms'
  import AiPanel from '#lib/ai/AiPanel.svelte'
  import CreationChat from '#lib/world/CreationChat.svelte'
  import { emptySeed, type SeedField } from '#lib/world/seed.ts'
  import { resolve } from '$app/paths'
  import { page } from '$app/state'
  import PrototypeSwitcher from '#lib/world/prototype/PrototypeSwitcher.svelte'
  import VariantA from '#lib/world/prototype/VariantA.svelte'
  import VariantB from '#lib/world/prototype/VariantB.svelte'
  import VariantC from '#lib/world/prototype/VariantC.svelte'
  import { createProtoStore } from '#lib/world/prototype/store.svelte.ts'
  import {
    GENRE_FLAVORS,
    MAGIC_LEVELS,
    PREMISE_SOFT_CAP,
    SCALES,
    TECH_LEVELS
  } from '#lib/world/enums.ts'

  let { data, form } = $props()

  // PROTOTYPE: ?variant= swaps the rendering of this page. Mutations in A/B/C are in-memory stubs.
  const variants = [
    { key: 'current', name: 'Current page' },
    { key: 'A', name: 'Master-detail' },
    { key: 'B', name: 'Dense table' },
    { key: 'C', name: 'Card library + shelf' }
  ]
  const variant = $derived(page.url.searchParams.get('variant') ?? 'current')
  // svelte-ignore state_referenced_locally
  const store = createProtoStore(data.worlds, data.archivedWorlds)

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

  const pickers = [
    { name: 'genreFlavor', label: 'Genre flavor', options: GENRE_FLAVORS },
    { name: 'scale', label: 'Scale', options: SCALES },
    { name: 'magicLevel', label: 'Magic level', options: MAGIC_LEVELS },
    { name: 'techLevel', label: 'Tech level', options: TECH_LEVELS }
  ] as const
</script>

{#snippet conversation()}
  <AiPanel>
    {#snippet chat(status, ai)}
      {#key chatKey}
        <CreationChat
          {seed}
          onaccept={(field, value) => (seed[field] = value)}
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
{/snippet}

{#snippet seedForm()}
  <form
    method="POST"
    action="?/createWorld"
    use:enhance
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
      <textarea name="premise" bind:value={seed.premise} rows="4" class="w-full rounded border p-2"
      ></textarea>
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
        <select name={picker.name} bind:value={seed[picker.name]} class="w-full rounded border p-2">
          <option value="">Unspecified</option>
          {#each picker.options as option (option)}
            <option value={option}>{option}</option>
          {/each}
        </select>
      </label>
    {/each}
    {#if form?.error}
      <p role="alert" class="text-sm text-red-600">{form.error}</p>
    {/if}
    <button type="submit" class="rounded bg-slate-800 px-3 py-2 text-white">Create World</button>
  </form>
{/snippet}

{#snippet create()}
  {@render conversation()}
  {@render seedForm()}
{/snippet}

{#if variant === 'A'}
  <VariantA {store} {create} />
{:else if variant === 'B'}
  <VariantB {store} {conversation} {seedForm} />
{:else if variant === 'C'}
  <VariantC {store} {create} />
{:else}
  <main class="mx-auto max-w-xl space-y-6 p-6">
    <h1 class="text-2xl font-semibold">Worlds</h1>

    {@render create()}

    {#if data.worlds.length === 0}
      <p class="text-slate-500">No Worlds yet.</p>
    {:else}
      <ul aria-label="Worlds" class="space-y-1">
        {#each data.worlds as world (world.id)}
          <li>
            <a href={resolve('/worlds/[id]/edit', { id: world.id })} class="underline"
              >{world.name}</a
            >
          </li>
        {/each}
      </ul>
    {/if}

    <a href={resolve('/worlds/archived')} class="text-sm underline">Archived Worlds</a>
  </main>
{/if}

<PrototypeSwitcher {variants} />
