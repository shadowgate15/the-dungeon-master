import { goto } from '$app/navigation'
import { resolve } from '$app/paths'
import type { CharacterWizard } from './wizard.svelte.ts'

/** Posts (or, when editing, puts) the draft. Success lands on the summary; failure keeps the draft and sets `wizard.saveError`. */
export async function submitDraft(wizard: CharacterWizard) {
  const input = wizard.characterInput
  if (!input) return
  wizard.saving = true
  wizard.saveError = null
  try {
    const editing = wizard.characterId
    const response = await fetch(
      editing ? resolve('/api/characters/[id]', { id: editing }) : resolve('/api/characters'),
      {
        method: editing ? 'PUT' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input)
      }
    )
    const result = (await response.json()) as { id?: string; error?: string }
    if (response.ok && result.id) {
      // Saved: the draft is no longer unsaved, so leaving must not ask to discard it.
      wizard.dirty = false
      // The path is resolved; `?saved` asks the summary for its success toast.
      // eslint-disable-next-line svelte/no-navigation-without-resolve
      await goto(`${resolve('/characters/[id]', { id: result.id })}?saved`)
      return
    }
    wizard.saveError = result.error ?? 'The Character could not be saved.'
  } catch {
    wizard.saveError = 'The Character could not be saved.'
  } finally {
    wizard.saving = false
  }
}
