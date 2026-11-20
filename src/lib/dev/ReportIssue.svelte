<script lang="ts">
  import Alert from '#lib/ui/Alert.svelte'
  import Button from '#lib/ui/Button.svelte'
  import Dialog from '#lib/ui/Dialog.svelte'
  import Field from '#lib/ui/Field.svelte'
  import Link from '#lib/ui/Link.svelte'
  import Textarea from '#lib/ui/Textarea.svelte'

  type Props = {
    /** The page the report is filed from. */
    url: string
    route: string | null
    params: Record<string, string>
    /** Injected so the dialog can be driven without a server. */
    fetcher?: typeof fetch
  }

  let { url, route, params, fetcher = fetch }: Props = $props()

  let open = $state(false)
  let description = $state('')
  let descriptionError = $state<string>()
  let sending = $state(false)
  let error = $state<string>()
  let issueUrl = $state<string>()

  const SEND_FAILED = 'The report could not be sent.'

  // A report that was sent starts over; one that was only closed is kept as drafted.
  const openDialog = () => {
    if (issueUrl) {
      description = ''
      issueUrl = undefined
    }
    error = undefined
    open = true
  }

  const send = async (event: SubmitEvent) => {
    event.preventDefault()
    error = undefined
    if (!description.trim()) {
      descriptionError = 'Add a description'
      return
    }
    descriptionError = undefined
    sending = true
    try {
      const response = await fetcher('/api/dev/report-issue', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          description,
          context: {
            url,
            route,
            params,
            viewport: { width: window.innerWidth, height: window.innerHeight },
            userAgent: navigator.userAgent
          }
        })
      })
      const result = (await response.json().catch(() => ({}))) as { url?: string; error?: string }
      if (response.ok && result.url) issueUrl = result.url
      else error = result.error ?? SEND_FAILED
    } catch {
      error = SEND_FAILED
    } finally {
      sending = false
    }
  }
</script>

<Button
  variant="secondary"
  size="sm"
  class="fixed bottom-4 left-4 z-50 shadow-overlay"
  onclick={openDialog}>Report an issue</Button
>

<Dialog bind:open title="Report an issue" closeHref={url} class="max-w-xl">
  {#if issueUrl}
    <Alert variant="success">
      Reported: <Link href={issueUrl} target="_blank" rel="noreferrer">{issueUrl}</Link>
    </Alert>
  {:else}
    <form onsubmit={send} class="space-y-4" novalidate>
      <Field
        label="What happened?"
        hint="The page, viewport and commit are attached for you. The title is written for you."
        error={descriptionError}
      >
        {#snippet children(id, describedby)}
          <Textarea {id} rows={5} bind:value={description} aria-describedby={describedby} />
        {/snippet}
      </Field>
      {#if error}
        <Alert variant="danger">{error}</Alert>
      {/if}
      <Button type="submit" disabled={sending}>{sending ? 'Filing…' : 'Send report'}</Button>
    </form>
  {/if}
</Dialog>
