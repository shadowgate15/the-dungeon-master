<script lang="ts">
  import { invalidateAll } from '$app/navigation'
  import AiPanel from '#lib/ai/AiPanel.svelte'
  import CreationChat from '#lib/world/CreationChat.svelte'
  import {
    CAMPAIGN_FIELD_LABELS,
    worldsPromptEstimate,
    type CampaignSeedCard,
    type CampaignSeedField,
    type WorldWithSeed
  } from './seed.ts'

  type Props = {
    /** The live Seed card. The chat reads it each turn; only accepted Proposals change it. */
    seed: CampaignSeedCard
    /** Writes an accepted Proposal onto the Seed card. */
    onaccept: (field: CampaignSeedField, value: string) => void
    /** The active Worlds with their Seed text, for the context meter's estimate. */
    worlds: WorldWithSeed[]
  }

  let { seed, onaccept, worlds }: Props = $props()

  // The AI never proposes Worlds: it gets the picker's current ids and the four proposable fields.
  const proposable = $derived({
    name: seed.name,
    premise: seed.premise,
    tone: seed.tone,
    length: seed.length
  })
  const worldsPrompts = $derived(worldsPromptEstimate(worlds, seed.worldIds))
</script>

<AiPanel>
  {#snippet chat(status, ai)}
    <CreationChat
      seed={proposable}
      onaccept={(field, value) => onaccept(field as CampaignSeedField, value)}
      endpoint="/api/campaign-creation"
      labels={CAMPAIGN_FIELD_LABELS}
      subject="Campaign"
      extraSystemPrompts={worldsPrompts}
      extraBody={{ worldIds: seed.worldIds }}
      onworldschanged={() => void invalidateAll()}
      disabled={status.state !== 'ready'}
      contextLength={status.state === 'ready' ? status.contextLength : null}
      fallbackContextLength={status.state === 'ready' ? status.fallbackContextLength : undefined}
      onreasoningmodel={ai.reasoningModel}
      onunavailable={ai.unavailable}
    />
  {/snippet}
</AiPanel>
