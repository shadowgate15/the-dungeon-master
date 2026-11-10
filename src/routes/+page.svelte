<script lang="ts">
  import { enhance } from '$app/forms'
  import AiStatusChip from '#lib/ai/AiStatusChip.svelte'
  import { createAiStatus } from '#lib/ai/ai-status.svelte.ts'
  import { createFieldAi } from '#lib/ai/field-ai.svelte.ts'
  import FieldAi from '#lib/ui/FieldAi.svelte'
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
  import {
    GENRE_FLAVORS,
    MAGIC_LEVELS,
    PREMISE_SOFT_CAP,
    SCALES,
    TECH_LEVELS
  } from '#lib/world/enums.ts'

  let { data, form } = $props()

  // The seed card's live values. The field AI controls read them and write their results
  // straight in. Only the values of a failed no-JS submit seed it.
  // svelte-ignore state_referenced_locally
  let seed = $state({ ...emptySeed(), ...pickSeed(form) })
  const aiStatus = createAiStatus()
  const fieldAi = createFieldAi<SeedField>({
    flow: 'world',
    ai: aiStatus,
    values: () => seed,
    set: (field, value) => (seed[field] = value)
  })

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

  const unspecified = { value: '', label: 'Unspecified' }
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
  <div class="space-y-2">
    <AiStatusChip ai={aiStatus} />
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
        }}
        class="space-y-2"
      >
        <FieldAi
          {...fieldAi.field('name')}
          label="Name"
          name="name"
          kind="text"
          bind:value={seed.name}
        />
        <FieldAi
          {...fieldAi.field('premise')}
          label="Premise"
          name="premise"
          kind="textarea"
          rows={4}
          bind:value={seed.premise}
        />
        {#if seed.premise.length > PREMISE_SOFT_CAP}
          <Alert variant="warning" role="status">
            Premise is long ({seed.premise.length} of about {PREMISE_SOFT_CAP} characters). You can still
            save it.
          </Alert>
        {/if}
        {#each pickers as picker (picker.name)}
          <FieldAi
            {...fieldAi.field(picker.name)}
            label={picker.label}
            name={picker.name}
            kind="enum"
            options={[unspecified, ...picker.options.map((o) => ({ value: o, label: o }))]}
            bind:value={seed[picker.name]}
          />
        {/each}
        {#if createFailed && form?.error}
          <Alert variant="danger">{form.error}</Alert>
        {/if}
        <Button type="submit">Create World</Button>
      </form>
    </div>
  </div>
</Dialog>
