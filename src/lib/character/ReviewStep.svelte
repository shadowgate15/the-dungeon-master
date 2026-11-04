<script lang="ts">
  import { goto } from '$app/navigation'
  import { resolve } from '$app/paths'
  import Alert from '#lib/ui/Alert.svelte'
  import Button from '#lib/ui/Button.svelte'
  import CharacterSummary from './CharacterSummary.svelte'
  import { draftToCharacterInput } from './save.ts'
  import { buildSummary, draftToSummaryData } from './summary.ts'
  import type { CharacterWizard } from './wizard.svelte.ts'

  let { wizard }: { wizard: CharacterWizard } = $props()

  const model = $derived(buildSummary(wizard.rules, draftToSummaryData(wizard.draft)))
  const payload = $derived.by(() => {
    try {
      return JSON.stringify(draftToCharacterInput(wizard.draft))
    } catch {
      return null
    }
  })

  let saving = $state(false)
  let error = $state<string | null>(null)

  /** Posts the draft. Success lands on the summary; failure keeps the draft and shows the error. */
  async function save() {
    if (payload === null) return
    saving = true
    error = null
    try {
      const response = await fetch(resolve('/api/characters'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: payload
      })
      const result = (await response.json()) as { id?: string; error?: string }
      if (response.ok && result.id) {
        // Saved: the draft is no longer unsaved, so leaving must not ask to discard it.
        wizard.dirty = false
        // The path is resolved; `?saved` asks the summary for its success toast.
        // eslint-disable-next-line svelte/no-navigation-without-resolve
        await goto(`${resolve('/characters/[id]', { id: result.id })}?saved`)
        return
      }
      error = result.error ?? 'The Character could not be saved.'
    } catch {
      error = 'The Character could not be saved.'
    } finally {
      saving = false
    }
  }
</script>

<div class="space-y-4">
  <CharacterSummary {model} />

  {#if error}
    <Alert variant="danger">{error} Your draft is kept; fix it and save again.</Alert>
  {/if}

  <Button type="button" disabled={payload === null || saving} onclick={save}>
    {saving ? 'Saving…' : 'Save Character'}
  </Button>
</div>
