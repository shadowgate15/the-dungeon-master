<script lang="ts">
  import type { Snippet } from 'svelte'
  import Button from '#lib/ui/Button.svelte'
  import Panel from '#lib/ui/Panel.svelte'
  import Textarea from '#lib/ui/Textarea.svelte'
  import { REASONING_MODEL_MESSAGE, type AiStatus } from './status.ts'

  type Props = {
    /** undefined until the first probe answers. */
    status: AiStatus | undefined
    checking: boolean
    oncheck: () => void
    /**
     * The chat UI. Rendered when the AI is ready, and also after a reasoning model was
     * detected so the transcript (with its failed turns) stays visible, disabled.
     * Otherwise disabled placeholder controls show.
     */
    /** Show disabled chat controls when there is no chat to render. Defaults to on. */
    chatPlaceholder?: boolean
    chat?: Snippet<[Extract<AiStatus, { state: 'ready' | 'reasoning-model' }>]>
  }

  let { status, checking, oncheck, chat, chatPlaceholder = true }: Props = $props()

  const ready = $derived(status?.state === 'ready' ? status : undefined)
  const chatStatus = $derived(
    status?.state === 'ready' || status?.state === 'reasoning-model' ? status : undefined
  )
</script>

<Panel title="AI">
  {#if status && status.state !== 'not-configured'}
    <p>Model: <span class="font-mono">{status.model}</span></p>
  {/if}

  {#if !status}
    <p class="text-muted">Checking connection…</p>
  {:else if status.state === 'ready'}
    <p>Connected</p>
  {:else if status.state === 'reasoning-model'}
    <p class="text-muted">{REASONING_MODEL_MESSAGE} The form works as usual.</p>
  {:else if status.state === 'not-configured'}
    <p class="text-muted">AI is not configured. The form works as usual.</p>
  {:else if status.state === 'unreachable'}
    <p class="text-muted">
      Not connected. Start LM Studio, or check the server configuration. The form works as usual.
    </p>
  {:else}
    <p class="text-muted">
      The model {status.model} is not available in LM Studio. Download or load it there. The form works
      as usual.
    </p>
  {/if}

  <Button variant="secondary" size="sm" type="button" onclick={oncheck} disabled={checking}>
    Check connection
  </Button>

  {#if chatStatus && chat}
    {@render chat(chatStatus)}
  {:else if chatPlaceholder}
    <fieldset disabled={!ready} class="space-y-1">
      <label class="block">
        <span class="block text-sm font-medium">Message</span>
        <Textarea rows={2} />
      </label>
      <Button type="button" size="sm">Send</Button>
    </fieldset>
  {/if}
</Panel>
