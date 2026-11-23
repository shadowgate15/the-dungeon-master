<script lang="ts">
  import { enhance } from '$app/forms'
  import { resolve } from '$app/paths'
  import Alert from '#lib/ui/Alert.svelte'
  import Button from '#lib/ui/Button.svelte'
  import Dialog from '#lib/ui/Dialog.svelte'
  import CampaignSeedCard from './CampaignSeedCard.svelte'
  import {
    emptyCampaignSeed,
    isCampaignSeedComplete,
    type CampaignSeedCard as Seed
  } from './seed.ts'

  type Props = {
    /** Values to show on open: a failed no-JS submit. */
    initial?: Partial<Seed>
    /** Service validation error from the last create attempt, shown inline. */
    error?: string
    /** Render open (server render of `?new`, or a failed create). */
    open?: boolean
    /** Called after the dialog closes. */
    onclose?: () => void
  }

  let { initial = {}, error, open = false, onclose }: Props = $props()

  // svelte-ignore state_referenced_locally
  let seed = $state<Seed>({ ...emptyCampaignSeed(), ...initial })
  // svelte-ignore state_referenced_locally
  let isOpen = $state(open)

  /** Opens the modal with a fresh card. */
  export function show() {
    seed = emptyCampaignSeed()
    isOpen = true
  }
</script>

<Dialog bind:open={isOpen} title="New Campaign" closeHref={resolve('/campaigns')} {onclose}>
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
    <CampaignSeedCard bind:seed />
    {#if error}
      <Alert variant="danger">{error}</Alert>
    {/if}
    <Button type="submit" disabled={!isCampaignSeedComplete(seed)}>Create Campaign</Button>
  </form>
</Dialog>
