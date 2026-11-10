<script lang="ts">
  import { enhance } from '$app/forms'
  import AiStatusChip from '#lib/ai/AiStatusChip.svelte'
  import { createAiStatus } from '#lib/ai/ai-status.svelte.ts'
  import { createFieldAi } from '#lib/ai/field-ai.svelte.ts'
  import Alert from '#lib/ui/Alert.svelte'
  import Button from '#lib/ui/Button.svelte'
  import CampaignSeedCard from './CampaignSeedCard.svelte'
  import type { CampaignSeedCard as Seed, CampaignSeedField } from './seed.ts'

  type Props = {
    /** The stored values to start from, or what was typed in a failed save. */
    initial: Seed
    /** Active Worlds the player may choose. */
    worlds: { id: string; name: string }[]
    /** Service validation error from the last save attempt, shown inline. */
    error?: string
    saved?: boolean
  }

  let { initial, worlds, error, saved = false }: Props = $props()

  // svelte-ignore state_referenced_locally
  let seed = $state<Seed>({ ...initial, worldIds: [...initial.worldIds] })
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
</script>

<div class="space-y-3">
  <AiStatusChip ai={aiStatus} />
  <form
    method="POST"
    action="?/save"
    use:enhance={() =>
      async ({ update }) => {
        await update({ reset: false })
      }}
    class="space-y-3"
  >
    <CampaignSeedCard bind:seed {worlds} {fieldAi} />
    {#if error}
      <Alert variant="danger">{error}</Alert>
    {/if}
    {#if saved}
      <Alert variant="success">Saved</Alert>
    {/if}
    <Button type="submit">Save changes</Button>
  </form>
</div>
