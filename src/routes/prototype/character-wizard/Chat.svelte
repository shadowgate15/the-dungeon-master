<!-- PROTOTYPE (throwaway): fake creation conversation. cardsInChat=false leaves Proposal cards to the step. -->
<script lang="ts">
  import Button from '#lib/ui/Button.svelte'
  import ChatBubble from '#lib/ui/ChatBubble.svelte'
  import Badge from '#lib/ui/Badge.svelte'
  import ProposalCards from './ProposalCards.svelte'
  import { STEP_LABELS, type Wizard } from './model.svelte.ts'

  let {
    w,
    cardsInChat = true,
    tall = false
  }: { w: Wizard; cardsInChat?: boolean; tall?: boolean } = $props()
  let text = $state('')
  function send(e: Event) {
    e.preventDefault()
    if (!text.trim()) return
    w.say(text.trim())
    text = ''
  }
</script>

<div class="flex flex-col gap-3 {tall ? 'h-full' : ''}">
  <div class="flex items-center justify-between text-sm">
    <span class="font-display">Creation conversation</span>
    <Badge size="sm">Aware of: {STEP_LABELS[w.current]}</Badge>
  </div>
  <div
    class="min-h-40 flex-1 space-y-3 overflow-y-auto rounded-panel border border-border bg-surface p-3 {tall
      ? ''
      : 'max-h-96'}"
  >
    {#each w.chat as m, i (i)}
      <div class="space-y-2">
        <ChatBubble role={m.from === 'you' ? 'user' : 'assistant'}>{m.text}</ChatBubble>
        {#if cardsInChat && m.proposalIds}<ProposalCards
            {w}
            step={m.step}
            ids={m.proposalIds}
          />{/if}
      </div>
    {/each}
  </div>
  <form class="flex gap-2" onsubmit={send}>
    <input
      class="min-w-0 flex-1 rounded-control border border-control-border bg-raised px-3 py-2 text-text"
      placeholder="Describe your hero…"
      bind:value={text}
    />
    <Button type="submit">Send</Button>
  </form>
</div>
