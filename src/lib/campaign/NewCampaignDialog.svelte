<script lang="ts">
  import { enhance } from '$app/forms'
  import { resolve } from '$app/paths'
  import { onMount, type Snippet } from 'svelte'
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
  let dialog = $state<HTMLDialogElement>()
  // Bumped whenever the dialog opens or closes, which discards the chat's transcript.
  let chatKey = $state(0)

  function accept(field: CampaignSeedField, value: string) {
    seed[field] = value
  }

  /** Opens the modal with a fresh card, pre-selecting the given Worlds. */
  export function show(worldIds: string[] = []) {
    seed = emptyCampaignSeed(worldIds.filter((id) => worlds.some((w) => w.id === id)))
    chatKey++
    dialog?.showModal()
  }

  // The server renders the dialog open without JS; with JS it becomes a real modal.
  onMount(() => {
    if (dialog?.open) {
      dialog.close()
      dialog.showModal()
    }
  })
</script>

<dialog
  bind:this={dialog}
  {open}
  aria-label="New Campaign"
  onclose={() => {
    chatKey++
    onclose?.()
  }}
  class="m-auto w-[min(72rem,calc(100vw-2rem))] rounded-lg p-6 backdrop:bg-black/50"
>
  <div class="mb-4 flex items-center justify-between">
    <h2 class="text-xl font-semibold">New Campaign</h2>
    <a
      href={resolve('/campaigns')}
      onclick={(e) => {
        e.preventDefault()
        dialog?.close()
      }}
      class="text-sm underline">Close</a
    >
  </div>

  {#if worlds.length === 0}
    <p class="py-6">
      A Campaign is set in a World, and you have no active Worlds. <a
        href={resolve('/')}
        class="underline">Create a World first.</a
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
            if (result.type === 'success') dialog?.close()
          }}
        class="space-y-3 lg:max-h-[70vh] lg:overflow-y-auto"
      >
        <CampaignSeedCard bind:seed {worlds} />
        {#if error}
          <p role="alert" class="text-sm text-red-600">{error}</p>
        {/if}
        <button
          type="submit"
          disabled={!isCampaignSeedComplete(seed)}
          class="rounded bg-slate-800 px-3 py-2 text-white disabled:opacity-40"
          >Create Campaign</button
        >
      </form>
    </div>
  {/if}
</dialog>
