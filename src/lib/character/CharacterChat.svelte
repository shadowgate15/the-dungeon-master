<script lang="ts">
  import AiPanel from '#lib/ai/AiPanel.svelte'
  import Alert from '#lib/ui/Alert.svelte'
  import CreationChat from '#lib/world/CreationChat.svelte'
  import {
    FIELD_LABELS,
    formatCardValue,
    isConversationStep,
    acceptPatch,
    seedOf,
    STEP_FIELDS,
    type ConversationStep
  } from './conversation.ts'
  import type { CharacterWizard } from './wizard.svelte.ts'

  /**
   * The persistent Creation conversation beside the wizard (#116). One transcript across steps;
   * each turn sends the draft and the active step, and an accepted card goes through
   * `wizard.update`, so the wizard's change rules always run. Without AI the panel only shows
   * its status and the wizard works unchanged.
   */
  let { wizard }: { wizard: CharacterWizard } = $props()

  const step = $derived(wizard.current)
  const supported = $derived(isConversationStep(step))
  const seed = $derived(seedOf(wizard.draft))

  /** Pending cards per step, for the rail's dot: a card belongs to the step owning its field. */
  function onpending(fields: string[]) {
    const counts: Partial<Record<ConversationStep, number>> = {}
    for (const [id, owned] of Object.entries(STEP_FIELDS) as [
      ConversationStep,
      readonly string[]
    ][]) {
      const n = fields.filter((f) => owned.includes(f)).length
      if (n) counts[id] = n
    }
    wizard.suggestions = counts
  }
</script>

<AiPanel>
  {#snippet chat(status, ai)}
    {#if !supported}
      <Alert variant="info">The assistant cannot help with this step yet. Use the form.</Alert>
    {/if}
    <CreationChat
      {seed}
      onaccept={(field, value) => wizard.update(acceptPatch(wizard.draft, field, value))}
      formatValue={formatCardValue}
      endpoint="/api/character-creation"
      labels={FIELD_LABELS}
      subject="Character"
      extraBody={{ step, draft: wizard.draft }}
      {onpending}
      disabled={status.state !== 'ready' || !supported}
      contextLength={status.state === 'ready' ? status.contextLength : null}
      fallbackContextLength={status.state === 'ready' ? status.fallbackContextLength : undefined}
      onreasoningmodel={ai.reasoningModel}
      onunavailable={ai.unavailable}
    />
  {/snippet}
</AiPanel>
