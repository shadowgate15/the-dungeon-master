<script lang="ts">
  import { enhance } from '$app/forms'
  import type { Snippet } from 'svelte'
  import CampaignSeedCard from './CampaignSeedCard.svelte'
  import type { CampaignSeedCard as Seed } from './seed.ts'

  type Props = {
    /** The stored values to start from, or what was typed in a failed save. */
    initial: Seed
    /** Active Worlds the player may choose. */
    worlds: { id: string; name: string }[]
    /** Service validation error from the last save attempt, shown inline. */
    error?: string
    saved?: boolean
    /** Slot for the chat pane (arrives in a later ticket); the Seed card is the right-hand column. */
    chat?: Snippet<[Seed]>
  }

  let { initial, worlds, error, saved = false, chat }: Props = $props()

  // svelte-ignore state_referenced_locally
  let seed = $state<Seed>({ ...initial, worldIds: [...initial.worldIds] })
</script>

<div class="grid gap-6 {chat ? 'lg:grid-cols-2' : ''}">
  {#if chat}
    <div class="space-y-2">{@render chat(seed)}</div>
  {/if}
  <form
    method="POST"
    action="?/save"
    use:enhance={() =>
      ({ update }) =>
        update({ reset: false })}
    class="space-y-3"
  >
    <CampaignSeedCard bind:seed {worlds} />
    {#if error}
      <p role="alert" class="text-sm text-red-600">{error}</p>
    {/if}
    {#if saved}
      <p role="status" class="text-sm text-green-700">Saved</p>
    {/if}
    <button type="submit" class="rounded bg-slate-800 px-3 py-2 text-white">Save changes</button>
  </form>
</div>
