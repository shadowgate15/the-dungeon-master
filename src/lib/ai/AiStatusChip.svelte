<script lang="ts">
  import Button from '#lib/ui/Button.svelte'
  import type { AiStatusStore } from './ai-status.svelte.ts'
  import { REASONING_MODEL_MESSAGE } from './status.ts'

  type Props = {
    /** The page's shared availability store. */
    ai: Pick<AiStatusStore, 'status' | 'checking'> & { check: () => unknown }
  }

  let { ai }: Props = $props()

  let details: HTMLDetailsElement | undefined = $state()

  const status = $derived(ai.status)
  const ready = $derived(status?.state === 'ready')
  const model = $derived(status && status.state !== 'not-configured' ? status.model : undefined)
  const dot = $derived(
    !status || status.state === 'not-configured'
      ? 'bg-muted'
      : status.state === 'ready'
        ? 'bg-success'
        : 'bg-warning'
  )
  const label = $derived(
    !status
      ? 'Checking AI…'
      : status.state === 'ready'
        ? status.model
        : status.state === 'not-configured'
          ? 'AI off'
          : 'AI unavailable'
  )
  const explanation = $derived.by(() => {
    switch (status?.state) {
      case undefined:
        return 'Checking connection…'
      case 'ready':
        return 'Connected'
      case 'not-configured':
        return 'AI is not configured. The form works as usual.'
      case 'unreachable':
        return 'Not connected. Start LM Studio, or check the server configuration. The form works as usual.'
      case 'model-unavailable':
        return `The model ${status.model} is not available in LM Studio. Download or load it there. The form works as usual.`
      case 'reasoning-model':
        return `${REASONING_MODEL_MESSAGE} The form works as usual.`
    }
  })

  function close() {
    if (details) details.open = false
  }
</script>

<svelte:window onclick={(e) => details && !details.contains(e.target as Node) && close()} />

<div role="region" aria-label="AI">
  <details bind:this={details} class="relative">
    <summary
      class="flex cursor-pointer list-none items-center gap-2 rounded-full border border-border bg-raised px-3 py-1 text-sm"
    >
      <span class={['size-2 rounded-full', dot]} aria-hidden="true"></span>
      <span class={ready ? 'font-mono' : ''}>{label}</span>
    </summary>
    <div
      class="absolute right-0 z-10 mt-1 w-72 space-y-2 rounded-control border border-border bg-surface p-3 text-sm shadow"
    >
      {#if model && !ready}<p>Model: <span class="font-mono">{model}</span></p>{/if}
      <p class={ready ? '' : 'text-muted'}>{explanation}</p>
      <Button
        variant="secondary"
        size="sm"
        type="button"
        onclick={() => ai.check()}
        disabled={ai.checking}
      >
        Check connection
      </Button>
    </div>
  </details>
</div>
