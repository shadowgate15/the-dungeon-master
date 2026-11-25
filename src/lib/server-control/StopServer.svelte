<script lang="ts">
  import Button from '#lib/ui/Button.svelte'

  // idle → confirming → stopped, or back to idle with a problem.
  let step = $state<'idle' | 'confirming' | 'stopping' | 'stopped'>('idle')
  let problem = $state<string | null>(null)

  /** Stops the game server, as `dm stop` does; any live Session loses its server. */
  async function stop() {
    step = 'stopping'
    try {
      const res = await fetch('/api/server/stop', { method: 'POST' })
      if (!res.ok) throw new Error()
      step = 'stopped'
    } catch {
      problem = 'The server could not be stopped. Run dm stop in a terminal.'
      step = 'idle'
    }
  }
</script>

{#if step === 'stopped'}
  <p role="status" class="text-sm">The game server stopped. Run dm to start it again.</p>
{:else if step === 'idle'}
  <div class="flex items-center gap-2">
    {#if problem}<p role="alert" class="text-sm text-danger">{problem}</p>{/if}
    <Button
      variant="ghost"
      size="sm"
      onclick={() => {
        problem = null
        step = 'confirming'
      }}>Stop server</Button
    >
  </div>
{:else}
  <div role="group" aria-label="Stop the game server" class="flex items-center gap-2 text-sm">
    <span>Stop the game server? A Session in play loses it.</span>
    <Button variant="danger" size="sm" disabled={step === 'stopping'} onclick={stop}
      >Stop the server</Button
    >
    <Button variant="secondary" size="sm" onclick={() => (step = 'idle')}>Cancel</Button>
  </div>
{/if}
