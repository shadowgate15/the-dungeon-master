<script lang="ts">
  import { enhance } from '$app/forms'
  import AiPanel from '#lib/ai/AiPanel.svelte'
  import CreationChat from '#lib/world/CreationChat.svelte'
  import { emptySeed, type SeedField } from '#lib/world/seed.ts'
  import { page } from '$app/state'
  import { replaceState } from '$app/navigation'
  import { resolve } from '$app/paths'
  import SectionNav from '#lib/SectionNav.svelte'
  import ActionToast from '#lib/world/ActionToast.svelte'
  import WorldTable from '#lib/world/WorldTable.svelte'
  import Alert from '#lib/ui/Alert.svelte'
  import Button from '#lib/ui/Button.svelte'
  import Dialog from '#lib/ui/Dialog.svelte'
  import Field from '#lib/ui/Field.svelte'
  import Select from '#lib/ui/Select.svelte'
  import Textarea from '#lib/ui/Textarea.svelte'
  import TextInput from '#lib/ui/TextInput.svelte'
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

  // A failed create reopens the dialog on the server render; other failures belong to the table.
  const createFailed = $derived(form !== null && form !== undefined && 'error' in form)
  const serverOpen = $derived(page.url.searchParams.has('new') || createFailed)
  // The server renders the dialog open without JS; Dialog upgrades it to a real modal.
  // svelte-ignore state_referenced_locally
  let open = $state(serverOpen)

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
    <h1 class="font-display text-2xl">Worlds</h1>
    <Button
      href="{resolve('/')}?new"
      onclick={(e: MouseEvent) => {
        e.preventDefault()
        open = true
      }}>New World</Button
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

<Dialog
  bind:open
  title="New World"
  closeHref={resolve('/')}
  onclose={() => {
    if (page.url.searchParams.has('new')) replaceState(resolve('/'), {})
  }}
>
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
            if (result.type === 'success') open = false
          }}
        onreset={() => {
          seed = emptySeed()
          chatKey++
        }}
        class="space-y-2"
      >
        <Field label="Name">
          {#snippet children(id)}
            <TextInput {id} name="name" bind:value={seed.name} />
          {/snippet}
        </Field>
        <Field label="Premise">
          {#snippet children(id)}
            <Textarea {id} name="premise" bind:value={seed.premise} rows={4} />
          {/snippet}
        </Field>
        {#if seed.premise.length > PREMISE_SOFT_CAP}
          <Alert variant="warning" role="status">
            Premise is long ({seed.premise.length} of about {PREMISE_SOFT_CAP} characters). You can still
            save it.
          </Alert>
        {/if}
        {#each pickers as picker (picker.name)}
          <Field label={picker.label}>
            {#snippet children(id)}
              <Select {id} name={picker.name} bind:value={seed[picker.name]}>
                <option value="">Unspecified</option>
                {#each picker.options as option (option)}
                  <option value={option}>{option}</option>
                {/each}
              </Select>
            {/snippet}
          </Field>
        {/each}
        {#if createFailed && form?.error}
          <Alert variant="danger">{form.error}</Alert>
        {/if}
        <Button type="submit">Create World</Button>
      </form>
    </div>
  </div>
</Dialog>
