<script lang="ts">
  import { enhance } from '$app/forms'
  import { resolve } from '$app/paths'
  import type { Snippet } from 'svelte'
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
    /** Slot for the chat pane, on the left; the Seed card is the right-hand column. */
    chat?: Snippet<[Seed, (field: CampaignSeedField, value: string) => void]>
  }

  let { worlds, initial = {}, error, open = false, onclose, chat }: Props = $props()

  // svelte-ignore state_referenced_locally
  let seed = $state<Seed>({ ...emptyCampaignSeed(), ...initial })
  // svelte-ignore state_referenced_locally
  let isOpen = $state(open)
  // Bumped whenever the dialog opens or closes, which discards the chat's transcript.
  let chatKey = $state(0)

  function accept(field: CampaignSeedField, value: string) {
    seed[field] = value
  }

  /** Opens the modal with a fresh card, pre-selecting the given Worlds. */
  export function show(worldIds: string[] = []) {
    seed = emptyCampaignSeed(worldIds.filter((id) => worlds.some((w) => w.id === id)))
    chatKey++
    isOpen = true
  }
</script>

<Dialog
  bind:open={isOpen}
  title="New Campaign"
  closeHref={resolve('/campaigns')}
  onclose={() => {
    chatKey++
    onclose?.()
  }}
>
  {#if worlds.length === 0}
    <p class="py-6">
      A Campaign is set in a World, and you have no active Worlds. <Link href={resolve('/')}
        >Create a World first.</Link
      >
    </p>
  {:else}
    <div class="grid gap-6 {chat ? 'lg:grid-cols-2' : ''}">
      {#if chat}
        <div class="space-y-2 lg:max-h-[70vh] lg:overflow-y-auto">
          {#key chatKey}{@render chat(seed, accept)}{/key}
        </div>
      {/if}
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
        <CampaignSeedCard bind:seed {worlds} />
        {#if error}
          <Alert variant="danger">{error}</Alert>
        {/if}
        <Button type="submit" disabled={!isCampaignSeedComplete(seed)}>Create Campaign</Button>
      </form>
    </div>
  {/if}
</Dialog>
