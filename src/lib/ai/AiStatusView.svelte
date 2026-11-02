<script lang="ts">
  import type { Snippet } from 'svelte'
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
    chat?: Snippet<[Extract<AiStatus, { state: 'ready' | 'reasoning-model' }>]>
  }

  let { status, checking, oncheck, chat }: Props = $props()

  const ready = $derived(status?.state === 'ready' ? status : undefined)
  const chatStatus = $derived(
    status?.state === 'ready' || status?.state === 'reasoning-model' ? status : undefined
  )
</script>

<section aria-label="AI" class="space-y-2 rounded border p-3">
  <h2 class="text-lg font-semibold">AI</h2>

  {#if status && status.state !== 'not-configured'}
    <p>Model: <span class="font-mono">{status.model}</span></p>
  {/if}

  {#if !status}
    <p class="text-slate-500">Checking connection…</p>
  {:else if status.state === 'ready'}
    <p>Connected</p>
  {:else if status.state === 'reasoning-model'}
    <p class="text-slate-500">{REASONING_MODEL_MESSAGE} The form works as usual.</p>
  {:else if status.state === 'not-configured'}
    <p class="text-slate-500">AI is not configured. The form works as usual.</p>
  {:else if status.state === 'unreachable'}
    <p class="text-slate-500">
      Not connected. Start LM Studio, or check the server configuration. The form works as usual.
    </p>
  {:else}
    <p class="text-slate-500">
      The model {status.model} is not available in LM Studio. Download or load it there. The form works
      as usual.
    </p>
  {/if}

  <button
    type="button"
    onclick={oncheck}
    disabled={checking}
    class="rounded border px-3 py-1 disabled:opacity-50"
  >
    Check connection
  </button>

  {#if chatStatus && chat}
    {@render chat(chatStatus)}
  {:else}
    <fieldset disabled={!ready} class="space-y-1">
      <label class="block">
        <span class="block text-sm font-medium">Message</span>
        <textarea rows="2" class="w-full rounded border p-2 disabled:opacity-50"></textarea>
      </label>
      <button type="button" class="rounded bg-slate-800 px-3 py-1 text-white disabled:opacity-50">
        Send
      </button>
    </fieldset>
  {/if}
</section>
