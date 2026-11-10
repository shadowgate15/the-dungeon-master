<!-- PROTOTYPE (throwaway): streaming transport + Stop. Wipe me. -->
<script lang="ts">
  let text = $state('I open the door.')
  let slow = $state(true)
  let live = $state('')
  let status = $state('idle')
  let server = $state<{ turns: unknown[]; inFlight: boolean; log: string[] }>()
  let controller: AbortController | undefined

  const refresh = async () => (server = await (await fetch('/proto-stream')).json())

  async function send() {
    live = ''
    status = 'generating'
    controller = new AbortController()
    try {
      const res = await fetch('/proto-stream', {
        method: 'POST',
        body: JSON.stringify({ text, slow }),
        signal: controller.signal
      })
      if (!res.ok || !res.body) {
        status = 'rejected ' + res.status
        return
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
      let buf = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buf += value
        const lines = buf.split('\n')
        buf = lines.pop()!
        for (const l of lines) {
          const e = JSON.parse(l)
          if (e.type === 'TEXT_MESSAGE_CONTENT') live += e.delta
          if (e.type === 'CUSTOM') live += `\n⟦roll request: ${e.value.check} DC ${e.value.dc}⟧`
          if (e.type === 'RUN_FINISHED') status = 'finished'
        }
      }
    } catch (e) {
      status = (e as Error).name === 'AbortError' ? 'stopped (client abort)' : 'error ' + e
    }
    setTimeout(refresh, 150)
  }
  const stop = () => controller?.abort()
  // "Close the browser" mid-stream: reload kills the fetch the same way.
  const closeTab = () => location.reload()
</script>

<h1>Streaming + Stop prototype</h1>
<input bind:value={text} size="40" />
<label><input type="checkbox" bind:checked={slow} /> slow</label>
<button onclick={send}>Send</button>
<button onclick={stop}>Stop</button>
<button onclick={closeTab}>Close tab (reload)</button>
<button onclick={refresh}>Refresh server state</button>
<button onclick={() => fetch('/proto-stream', { method: 'DELETE' }).then(refresh)}>Reset</button>
<p>client status: <b>{status}</b></p>
<h3>Live DM text (client buffer, not persisted)</h3>
<pre style="white-space: pre-wrap">{live}</pre>
<h3>Server state</h3>
<pre>{JSON.stringify(server, null, 2)}</pre>
