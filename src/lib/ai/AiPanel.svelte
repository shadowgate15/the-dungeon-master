<script lang="ts">
  import type { Snippet } from 'svelte'
  import { createAiStatus, type AiStatusStore } from './ai-status.svelte.ts'
  import AiStatusView from './AiStatusView.svelte'
  import type { AiStatus } from './status.ts'

  type Props = {
    chat?: Snippet<
      [
        Extract<AiStatus, { state: 'ready' | 'reasoning-model' }>,
        { reasoningModel: () => void; unavailable: (status: AiStatus) => void }
      ]
    >
    /** The shared availability store, when the page has per-field AI controls too. */
    ai?: AiStatusStore
  }

  let { chat, ai: shared }: Props = $props()

  // Pages that also render field controls pass the one shared store; chat pages create their own.
  // svelte-ignore state_referenced_locally
  const ai = shared ?? createAiStatus()
</script>

<AiStatusView
  status={ai.status}
  checking={ai.checking}
  oncheck={() => ai.check()}
  chat={chat ? chatWithActions : undefined}
  chatPlaceholder={!!chat}
/>

{#snippet chatWithActions(status: Extract<AiStatus, { state: 'ready' | 'reasoning-model' }>)}
  {@render chat?.(status, { reasoningModel: ai.reasoningModel, unavailable: ai.unavailable })}
{/snippet}
