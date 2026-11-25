<script lang="ts">
  import { enhance } from '$app/forms'
  import { resolve } from '$app/paths'
  import Alert from '#lib/ui/Alert.svelte'
  import Button from '#lib/ui/Button.svelte'
  import Dialog from '#lib/ui/Dialog.svelte'
  import Field from '#lib/ui/Field.svelte'
  import TextInput from '#lib/ui/TextInput.svelte'

  type Props = {
    /** The default root new Campaign folders go under. */
    root: string
    /** Values to show on open: a failed no-JS submit. */
    initial?: { name?: string; folder?: string }
    /** Error from the last create attempt, shown inline. */
    error?: string
    /** Render open (server render of `?new`, or a failed create). */
    open?: boolean
    /** Called after the dialog closes. */
    onclose?: () => void
  }

  let { root, initial = {}, error, open = false, onclose }: Props = $props()

  // svelte-ignore state_referenced_locally
  let name = $state(initial.name ?? '')
  // svelte-ignore state_referenced_locally
  let customFolder = $state<string | undefined>(initial.folder)
  // svelte-ignore state_referenced_locally
  let isOpen = $state(open)

  /** A folder name from the Campaign name: lowercase words joined by dashes. */
  const slug = (text: string) =>
    text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

  const separator = $derived(root.includes('\\') && !root.includes('/') ? '\\' : '/')
  // The folder follows the name until the Player edits it.
  const suggested = $derived(`${root.replace(/[\\/]+$/, '')}${separator}${slug(name)}`)
  const folder = $derived(customFolder ?? suggested)

  /** Opens the modal with a fresh form. */
  export function show() {
    name = ''
    customFolder = undefined
    isOpen = true
  }
</script>

<Dialog bind:open={isOpen} title="New Campaign" closeHref={resolve('/campaigns')} {onclose}>
  <form method="POST" action="?/createCampaign" use:enhance class="space-y-3">
    <Field label="Name">
      {#snippet children(id, describedby)}
        <TextInput {id} name="name" aria-describedby={describedby} bind:value={name} />
      {/snippet}
    </Field>
    <Field label="Folder" hint="The Campaign lives in this folder. You can commit it with git.">
      {#snippet children(id, describedby)}
        <TextInput
          {id}
          name="folder"
          aria-describedby={describedby}
          value={folder}
          oninput={(e: Event) => (customFolder = (e.currentTarget as HTMLInputElement).value)}
        />
      {/snippet}
    </Field>
    {#if error}
      <Alert variant="danger">{error}</Alert>
    {/if}
    <Button type="submit" disabled={name.trim() === '' || folder.trim() === ''}>
      Create Campaign
    </Button>
  </form>
</Dialog>
