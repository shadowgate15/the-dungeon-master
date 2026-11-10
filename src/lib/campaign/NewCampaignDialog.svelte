<script lang="ts">
  import { enhance } from '$app/forms'
  import { resolve } from '$app/paths'
  import AiStatusChip from '#lib/ai/AiStatusChip.svelte'
  import { createAiStatus } from '#lib/ai/ai-status.svelte.ts'
  import { createFieldAi } from '#lib/ai/field-ai.svelte.ts'
  import Alert from '#lib/ui/Alert.svelte'
  import Button from '#lib/ui/Button.svelte'
  import Dialog from '#lib/ui/Dialog.svelte'
  import Link from '#lib/ui/Link.svelte'
  import CampaignSeedCard from './CampaignSeedCard.svelte'
  import {
    emptyCampaignSeed,
    isCampaignSeedComplete,
    type CampaignSeedCard as Seed,
    type CampaignSeedField
  } from './seed.ts'

  type Props = {
    /** Active Worlds the player may choose. */
    worlds: { id: string; name: string }[]
    /** Values to show on open: a failed no-JS submit, or the World the list is filtered by. */
    initial?: Partial<Seed>
    /** Service validation error from the last create attempt, shown inline. */
    error?: string
    /** Render open (server render of `?new`, or a failed create). */
    open?: boolean
    /** Called after the dialog closes. */
    onclose?: () => void
  }

  let { worlds, initial = {}, error, open = false, onclose }: Props = $props()

  // svelte-ignore state_referenced_locally
  let seed = $state<Seed>({ ...emptyCampaignSeed(), ...initial })
  // svelte-ignore state_referenced_locally
  let isOpen = $state(open)
  const aiStatus = createAiStatus()
  const fieldAi = createFieldAi<CampaignSeedField>({
    flow: 'campaign',
    ai: aiStatus,
    values: () => ({
      name: seed.name,
      premise: seed.premise,
      tone: seed.tone,
      length: seed.length
    }),
    extra: () => ({ worldIds: seed.worldIds }),
    set: (field, value) => (seed[field] = value)
  })

  /** Opens the modal with a fresh card, pre-selecting the given Worlds. */
  export function show(worldIds: string[] = []) {
    seed = emptyCampaignSeed(worldIds.filter((id) => worlds.some((w) => w.id === id)))
    isOpen = true
  }
</script>

<Dialog
  bind:open={isOpen}
  title="New Campaign"
  closeHref={resolve('/campaigns')}
  {onclose}
  headerExtra={worlds.length > 0 ? headerExtra : undefined}
>
  {#if worlds.length === 0}
    <p class="py-6">
      A Campaign is set in a World, and you have no active Worlds. <Link href={resolve('/')}
        >Create a World first.</Link
      >
    </p>
  {:else}
    <div class="space-y-3">
      <form
        method="POST"
        action="?/createCampaign"
        use:enhance={() =>
          async ({ result, update }) => {
            await update()
            if (result.type === 'success') isOpen = false
          }}
        class="space-y-3 lg:max-h-[70vh] lg:overflow-y-auto"
      >
        <CampaignSeedCard bind:seed {worlds} {fieldAi} />
        {#if error}
          <Alert variant="danger">{error}</Alert>
        {/if}
        <Button type="submit" disabled={!isCampaignSeedComplete(seed)}>Create Campaign</Button>
      </form>
    </div>
  {/if}
</Dialog>

{#snippet headerExtra()}
  <AiStatusChip ai={aiStatus} />
{/snippet}
