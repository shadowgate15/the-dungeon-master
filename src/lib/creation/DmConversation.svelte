<script lang="ts">
  import Alert from '#lib/ui/Alert.svelte'
  import Button from '#lib/ui/Button.svelte'
  import Textarea from '#lib/ui/Textarea.svelte'
  import { follow } from '#lib/ui/follow.svelte.ts'
  import { conversationActions, createConversationQuery } from './client.ts'
  import type { ConversationMessage } from './conversation.ts'

  type Props = {
    campaign: string
    /** The Campaign folder, shown in the `dm` command while the DM is away. */
    folder: string
    /** Whether a DM session is attached to the Campaign. */
    attached: boolean
    messages: ConversationMessage[]
    /** Read-only: an archived Campaign takes no messages. */
    disabled?: boolean
  }

  let { campaign, folder, attached, messages, disabled = false }: Props = $props()

  const conversation = createConversationQuery(
    () => campaign,
    () => messages
  )
  const actions = conversationActions(() => campaign)

  let text = $state('')
  let sending = $state(false)
  let error = $state<string | null>(null)

  async function send(e: SubmitEvent) {
    e.preventDefault()
    const message = text.trim()
    if (!message || sending) return
    sending = true
    error = null
    try {
      await actions.send(message)
      text = ''
    } catch (err) {
      error = (err as Error).message
    } finally {
      sending = false
    }
  }
</script>

<section
  aria-label="Ask the DM"
  class="flex h-full min-h-80 flex-col rounded-lg border border-border bg-surface lg:rounded-none lg:border-0"
>
  <header class="flex items-center gap-2 border-b border-border px-4 py-3">
    <h2 class="font-display text-lg">Ask the DM</h2>
  </header>

  <ol
    {@attach follow(() => conversation.data.length > 0)}
    aria-label="Conversation"
    class="flex-1 space-y-2 overflow-y-auto px-4 py-3"
  >
    {#each conversation.data as line (line.id)}
      {#if line.author === 'dm_write'}
        <li class="text-center text-xs text-muted italic">✎ {line.text}</li>
      {:else}
        <li
          class={[
            'max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap',
            line.author === 'player'
              ? 'ml-auto bg-raised text-text'
              : 'mr-auto border border-border text-text'
          ]}
        >
          <span class="sr-only">{line.author === 'player' ? 'You' : 'DM'}:</span>
          {line.text}
        </li>
      {/if}
    {:else}
      <li class="text-sm text-muted">
        Ask for ideas, a premise, a backstory or help with a choice. The DM can fill in fields for
        you, marked ✎ DM.
      </li>
    {/each}
  </ol>

  <div class="space-y-2 border-t border-border px-4 py-3">
    {#if !attached}
      <p class="text-sm text-muted" role="status">
        The forms work without the DM. To ask the DM for help, run <code
          class="rounded bg-raised px-1 break-all">cd {folder} && dm</code
        > in a terminal.
      </p>
    {/if}
    {#if error}<Alert variant="danger">{error}</Alert>{/if}
    <form class="space-y-2" onsubmit={send}>
      <Textarea
        aria-label="Message to the DM"
        rows={3}
        disabled={disabled || !attached || sending}
        bind:value={text}
        onkeydown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            e.currentTarget.form?.requestSubmit()
          }
        }}
      />
      <Button type="submit" disabled={disabled || !attached || sending || !text.trim()}>Send</Button
      >
    </form>
  </div>
</section>
