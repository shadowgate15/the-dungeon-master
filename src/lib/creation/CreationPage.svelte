<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { ConversationMessage } from './conversation.ts'
  import DmConversation from './DmConversation.svelte'

  type Props = {
    /** The DM pane's Campaign; null (a missing folder) shows no pane. */
    pane: {
      campaign: string
      folder: string
      attached: boolean
      messages: ConversationMessage[]
      disabled: boolean
    } | null
    /** The Seed form reads best narrow; the wizard needs the room. */
    width?: 'narrow' | 'wide'
    children: Snippet
  }

  let { pane, width = 'wide', children }: Props = $props()
</script>

<!-- The creation stepper pages: the step's forms, with the DM pane docked on the right at full height. -->
<div class={pane ? 'lg:pr-96' : undefined}>
  <main class={['mx-auto space-y-6 p-6', width === 'narrow' ? 'max-w-3xl' : 'max-w-7xl']}>
    {@render children()}
  </main>
  {#if pane}
    <aside
      class="p-6 pt-0 lg:fixed lg:top-12 lg:right-0 lg:bottom-0 lg:w-96 lg:border-l lg:border-border lg:p-0"
      data-testid="dm-pane"
    >
      <DmConversation {...pane} />
    </aside>
  {/if}
</div>
